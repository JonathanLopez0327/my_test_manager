import { randomBytes } from "crypto";
import type {
  OrgInvite,
  OrgInviteStatus,
  OrgRole,
  Organization,
  PrismaClient,
} from "@/generated/prisma/client";

export type InviteErrorCode =
  | "ORG_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "ALREADY_MEMBER"
  | "PENDING_INVITE_EXISTS"
  | "MEMBER_LIMIT_REACHED"
  | "INVITE_NOT_FOUND"
  | "INVITE_NOT_PENDING"
  | "INVITE_EXPIRED"
  | "INVITE_EMAIL_MISMATCH";

export class InviteError extends Error {
  code: InviteErrorCode;
  status: number;

  constructor(code: InviteErrorCode, message: string, status = 400) {
    super(message);
    this.name = "InviteError";
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_EXPIRY_DAYS = 7;

type TransactionClient = Parameters<PrismaClient["$transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;

type DbClient = PrismaClient | TransactionClient;

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function computeExpiryDate(days = DEFAULT_EXPIRY_DAYS): Date {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + days);
  return now;
}

/**
 * Create an invite for an organization.
 *
 * Preconditions:
 * - Organization exists.
 * - No existing member with that email.
 * - No existing pending invite with that email.
 * - Org has room under `maxMembers` (active members + pending invites).
 */
export type CreateInviteInput = {
  organizationId: string;
  email: string;
  role: OrgRole;
  invitedById: string;
  expiresInDays?: number;
};

export type CreateInviteResult = {
  id: string;
  token: string;
  email: string;
  role: OrgRole;
  expiresAt: Date;
};

export async function createInvite(
  input: CreateInviteInput,
  prisma: PrismaClient,
): Promise<CreateInviteResult> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    throw new InviteError("VALIDATION_ERROR", "A valid email is required.", 400);
  }

  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, maxMembers: true },
  });
  if (!org) {
    throw new InviteError("ORG_NOT_FOUND", "Organization not found.", 404);
  }

  const existingMember = await prisma.organizationMember.findFirst({
    where: {
      organizationId: org.id,
      user: { email },
    },
    select: { userId: true },
  });
  if (existingMember) {
    throw new InviteError(
      "ALREADY_MEMBER",
      "This user is already a member of the organization.",
      409,
    );
  }

  const existingInvite = await prisma.orgInvite.findFirst({
    where: {
      organizationId: org.id,
      email,
      status: "pending",
    },
    select: { id: true },
  });
  if (existingInvite) {
    throw new InviteError(
      "PENDING_INVITE_EXISTS",
      "A pending invite already exists for this email.",
      409,
    );
  }

  const [memberCount, pendingInviteCount] = await Promise.all([
    prisma.organizationMember.count({
      where: { organizationId: org.id },
    }),
    prisma.orgInvite.count({
      where: { organizationId: org.id, status: "pending" },
    }),
  ]);

  if (memberCount + pendingInviteCount >= org.maxMembers) {
    throw new InviteError(
      "MEMBER_LIMIT_REACHED",
      "Member limit reached. Revoke pending invites or upgrade your plan.",
      409,
    );
  }

  const token = generateInviteToken();
  const expiresAt = computeExpiryDate(input.expiresInDays);

  const created = await prisma.orgInvite.create({
    data: {
      organizationId: org.id,
      email,
      role: input.role,
      token,
      invitedById: input.invitedById,
      expiresAt,
    },
    select: { id: true, token: true, email: true, role: true, expiresAt: true },
  });

  return created;
}

/**
 * List invites for an organization. By default returns pending + expired
 * (anything not consumed/revoked) so the admin can retry or clean them up.
 */
export type InviteListItem = {
  id: string;
  email: string;
  role: OrgRole;
  status: OrgInviteStatus;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: { id: string; fullName: string | null; email: string } | null;
};

export async function listOrgInvites(
  organizationId: string,
  prisma: PrismaClient,
  options?: { statuses?: OrgInviteStatus[] },
): Promise<InviteListItem[]> {
  const statuses = options?.statuses ?? ["pending"];
  const invites = await prisma.orgInvite.findMany({
    where: {
      organizationId,
      status: { in: statuses },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      token: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: { select: { id: true, fullName: true, email: true } },
    },
  });
  return invites;
}

export async function revokeInvite(
  inviteId: string,
  organizationId: string,
  revokedById: string,
  prisma: PrismaClient,
): Promise<void> {
  const invite = await prisma.orgInvite.findUnique({
    where: { id: inviteId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!invite || invite.organizationId !== organizationId) {
    throw new InviteError("INVITE_NOT_FOUND", "Invite not found.", 404);
  }
  if (invite.status !== "pending") {
    throw new InviteError(
      "INVITE_NOT_PENDING",
      `Invite is already ${invite.status}.`,
      409,
    );
  }
  await prisma.orgInvite.update({
    where: { id: invite.id },
    data: {
      status: "revoked",
      revokedAt: new Date(),
      revokedById,
    },
  });
}

/**
 * Validates a token without consuming it. Used by the public `/invite/[token]`
 * landing page to show org name, email, role.
 *
 * Marks expired invites (status=pending + expiresAt<now) as `expired` so
 * subsequent lookups short-circuit.
 */
export type InviteValidation = {
  id: string;
  email: string;
  role: OrgRole;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  expiresAt: Date;
};

export async function validateInviteToken(
  token: string,
  prisma: PrismaClient,
): Promise<InviteValidation> {
  const invite = await prisma.orgInvite.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      organization: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  if (!invite) {
    throw new InviteError("INVITE_NOT_FOUND", "Invite not found.", 404);
  }

  if (invite.status === "revoked") {
    throw new InviteError("INVITE_NOT_PENDING", "This invite was revoked.", 410);
  }

  if (invite.status === "consumed") {
    throw new InviteError(
      "INVITE_NOT_PENDING",
      "This invite has already been used.",
      410,
    );
  }

  if (invite.status === "expired" || invite.expiresAt.getTime() <= Date.now()) {
    if (invite.status === "pending") {
      await prisma.orgInvite
        .update({ where: { id: invite.id }, data: { status: "expired" } })
        .catch(() => undefined);
    }
    throw new InviteError("INVITE_EXPIRED", "This invite has expired.", 410);
  }

  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    organizationId: invite.organization.id,
    organizationName: invite.organization.name,
    organizationSlug: invite.organization.slug,
    expiresAt: invite.expiresAt,
  };
}

/**
 * Consume an invite for an existing authenticated user. Verifies the invite's
 * email matches the user's email, then adds the user to the org and marks
 * the invite as consumed atomically.
 */
export async function consumeInviteForUser(
  token: string,
  userId: string,
  userEmail: string,
  prisma: PrismaClient,
): Promise<{ organizationId: string; organizationSlug: string; role: OrgRole }> {
  const normalizedUserEmail = normalizeEmail(userEmail);
  const validation = await validateInviteToken(token, prisma);

  if (validation.email !== normalizedUserEmail) {
    throw new InviteError(
      "INVITE_EMAIL_MISMATCH",
      "This invite was sent to a different email address.",
      403,
    );
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: validation.organizationId,
          userId,
        },
      },
      select: { userId: true },
    });

    if (existing) {
      // Already a member — mark invite consumed and return.
      await tx.orgInvite.update({
        where: { id: validation.id },
        data: {
          status: "consumed",
          usedAt: new Date(),
          usedById: userId,
        },
      });
      return {
        organizationId: validation.organizationId,
        organizationSlug: validation.organizationSlug,
        role: validation.role,
      };
    }

    await tx.organizationMember.create({
      data: {
        organizationId: validation.organizationId,
        userId,
        role: validation.role,
      },
    });

    await tx.orgInvite.update({
      where: { id: validation.id },
      data: {
        status: "consumed",
        usedAt: new Date(),
        usedById: userId,
      },
    });

    return {
      organizationId: validation.organizationId,
      organizationSlug: validation.organizationSlug,
      role: validation.role,
    };
  });
}

/**
 * Locks an invite inside an existing transaction and returns it if valid.
 * Used by the signup flow to attach a new user to an org in the same
 * transaction that creates the user.
 *
 * IMPORTANT: the caller is responsible for calling `markInviteConsumed` with
 * the new user's id once the user is created.
 */
export async function readPendingInviteForSignup(
  token: string,
  email: string,
  tx: DbClient,
): Promise<{
  id: string;
  organizationId: string;
  role: OrgRole;
  organizationSlug: string;
}> {
  const normalized = normalizeEmail(email);
  const invite = await tx.orgInvite.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      organization: { select: { id: true, slug: true } },
    },
  });

  if (!invite) {
    throw new InviteError("INVITE_NOT_FOUND", "Invite not found.", 404);
  }
  if (invite.status !== "pending") {
    throw new InviteError(
      "INVITE_NOT_PENDING",
      `Invite is already ${invite.status}.`,
      410,
    );
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new InviteError("INVITE_EXPIRED", "This invite has expired.", 410);
  }
  if (invite.email !== normalized) {
    throw new InviteError(
      "INVITE_EMAIL_MISMATCH",
      "This invite was sent to a different email address.",
      403,
    );
  }

  return {
    id: invite.id,
    organizationId: invite.organization.id,
    organizationSlug: invite.organization.slug,
    role: invite.role,
  };
}

export async function markInviteConsumed(
  inviteId: string,
  userId: string,
  tx: DbClient,
): Promise<void> {
  await tx.orgInvite.update({
    where: { id: inviteId },
    data: {
      status: "consumed",
      usedAt: new Date(),
      usedById: userId,
    },
  });
}

export type { OrgInvite, OrgInviteStatus, Organization };
