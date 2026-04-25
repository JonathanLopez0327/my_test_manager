import { randomBytes } from "crypto";
import { hashPassword } from "./password-hash";
import type {
  OrgRole,
  PrismaClient,
  SignupRequestProvider,
  SignupRequestStatus,
} from "@/generated/prisma/client";
import { normalizeSlug, type SignUpInput } from "@/lib/schemas/sign-up";
import { generateBetaCode } from "@/lib/beta/generate-code";
import {
  createKeygenUser,
  createKeygenLicense,
  deleteKeygenLicense,
  deleteKeygenUser,
  getLicenseQuotas,
} from "@/lib/keygen/client";
import {
  InviteError,
  markInviteConsumed,
  readPendingInviteForSignup,
} from "@/lib/invites/invite-service";

type ProvisionedLicense = {
  keygenUserId: string;
  keygenLicenseId: string;
  quotas: {
    maxProjects: number;
    maxMembers: number;
    maxTestCases: number;
    maxTestRuns: number;
  };
};

async function provisionLicense(
  email: string,
  displayName: string,
): Promise<ProvisionedLicense> {
  const policyId = process.env.KEYGEN_POLICY_BETA_ID;
  if (!policyId) {
    throw new SignUpError(
      "LICENSE_PROVISIONING_FAILED",
      "Licensing is not configured. Please contact support.",
      503,
    );
  }

  let keygenUserId: string;
  try {
    keygenUserId = await createKeygenUser(email, displayName);
  } catch (err) {
    console.error("[keygen] createKeygenUser failed in signup:", err);
    throw new SignUpError(
      "LICENSE_PROVISIONING_FAILED",
      "Could not create your license. Please try again.",
      503,
    );
  }

  let keygenLicenseId: string;
  try {
    keygenLicenseId = await createKeygenLicense(keygenUserId, policyId);
  } catch (err) {
    console.error("[keygen] createKeygenLicense failed in signup:", err);
    await deleteKeygenUser(keygenUserId).catch((cleanupErr) => {
      console.error(
        "[keygen] failed to delete orphaned user during signup rollback:",
        cleanupErr,
      );
    });
    throw new SignUpError(
      "LICENSE_PROVISIONING_FAILED",
      "Could not create your license. Please try again.",
      503,
    );
  }

  try {
    const quotas = await getLicenseQuotas(keygenLicenseId);
    return { keygenUserId, keygenLicenseId, quotas };
  } catch (err) {
    console.error("[keygen] getLicenseQuotas failed in signup:", err);
    await rollbackKeygen(keygenUserId, keygenLicenseId);
    throw new SignUpError(
      "LICENSE_PROVISIONING_FAILED",
      "Could not create your license. Please try again.",
      503,
    );
  }
}

async function rollbackKeygen(
  keygenUserId: string,
  keygenLicenseId: string,
): Promise<void> {
  await deleteKeygenLicense(keygenLicenseId).catch((err) => {
    console.error(
      "[keygen] failed to delete license during signup rollback:",
      err,
    );
  });
  await deleteKeygenUser(keygenUserId).catch((err) => {
    console.error(
      "[keygen] failed to delete user during signup rollback:",
      err,
    );
  });
}

const DEFAULT_ORG_SLUG = "organization";
const ORG_SLUG_MAX_LENGTH = 50;

type TransactionClient = Parameters<PrismaClient["$transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;

export type SignUpErrorCode =
  | "VALIDATION_ERROR"
  | "EMAIL_TAKEN"
  | "REQUEST_ALREADY_EXISTS"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_NOT_PENDING"
  | "LICENSE_PROVISIONING_FAILED"
  | "INVITE_NOT_FOUND"
  | "INVITE_NOT_PENDING"
  | "INVITE_EXPIRED"
  | "INVITE_EMAIL_MISMATCH"
  | "UNKNOWN_ERROR";

export class SignUpError extends Error {
  code: SignUpErrorCode;
  status: number;
  fieldErrors?: Record<string, string[] | undefined>;

  constructor(
    code: SignUpErrorCode,
    message: string,
    status = 400,
    fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = "SignUpError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function truncateSlugBase(base: string, suffix = "") {
  const maxBaseLength = Math.max(1, ORG_SLUG_MAX_LENGTH - suffix.length);
  return base.slice(0, maxBaseLength);
}

export function createSlugCandidate(name: string, explicitSlug?: string) {
  const normalizedExplicit = explicitSlug ? normalizeSlug(explicitSlug) : "";
  if (normalizedExplicit.length >= 3) {
    return truncateSlugBase(normalizedExplicit);
  }

  const normalizedName = normalizeSlug(name);
  if (normalizedName.length >= 3) {
    return truncateSlugBase(normalizedName);
  }

  return DEFAULT_ORG_SLUG;
}

export function resolveUniqueSlug(baseSlug: string, existingSlugs: string[]) {
  const normalizedBase = truncateSlugBase(normalizeSlug(baseSlug) || DEFAULT_ORG_SLUG);
  const used = new Set(existingSlugs);
  if (!used.has(normalizedBase)) {
    return normalizedBase;
  }

  let sequence = 2;
  while (sequence < 100_000) {
    const suffix = `-${sequence}`;
    const candidate = `${truncateSlugBase(normalizedBase, suffix)}${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
    sequence += 1;
  }

  return `${truncateSlugBase(normalizedBase, "-ts")}-ts`;
}


async function generateUniqueOrganizationSlug(tx: TransactionClient, desired: string) {
  const existing = await tx.organization.findMany({
    where: { slug: { startsWith: desired } },
    select: { slug: true },
  });
  return resolveUniqueSlug(
    desired,
    existing.map((item) => item.slug),
  );
}

function deriveDisplayName(email: string, fullName?: string | null) {
  const normalized = fullName?.trim();
  if (normalized) {
    return normalized;
  }

  const localPart = email.split("@")[0] ?? "User";
  const humanized = localPart
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\s{2,}/g, " ");

  if (!humanized) {
    return "User";
  }

  return humanized
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function deriveNameParts(email: string, fullName?: string | null) {
  const displayName = deriveDisplayName(email, fullName);
  const parts = displayName
    .split(" ")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const fallback = email
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .split(" ")
    .map((segment) => segment.trim())
    .filter(Boolean) ?? [];

  const firstName = parts[0] ?? fallback[0] ?? "User";
  const lastName = parts.length > 1 ? parts[parts.length - 1] : (fallback[1] ?? "Member");

  return { firstName, lastName };
}

function deriveGoogleOrganizationName(
  email: string,
  fullName?: string | null,
  shortGuid?: string,
) {
  const { firstName, lastName } = deriveNameParts(email, fullName);
  const suffix = shortGuid ?? randomBytes(4).toString("hex");
  const base = `${firstName} ${lastName} ${suffix}`.trim();
  return base.length <= 120 ? base : base.slice(0, 120);
}

export type SignupRequestCreationResult = {
  requestId: string;
  status: SignupRequestStatus;
};

type GoogleSignUpInput = {
  email: string;
  fullName?: string | null;
};

async function assertEmailAvailableForRequest(
  prisma: PrismaClient,
  email: string,
): Promise<{ existingRequestId: string | null }> {
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new SignUpError(
      "EMAIL_TAKEN",
      "An account with that email already exists.",
      409,
      { email: ["An account with that email already exists."] },
    );
  }

  const existingRequest = await prisma.signupRequest.findUnique({
    where: { email },
    select: { id: true, status: true },
  });

  if (!existingRequest) {
    return { existingRequestId: null };
  }

  if (existingRequest.status === "pending") {
    throw new SignUpError(
      "REQUEST_ALREADY_EXISTS",
      "A signup request for this email is already pending approval.",
      409,
      { email: ["A signup request for this email is already pending approval."] },
    );
  }

  if (existingRequest.status === "approved") {
    throw new SignUpError(
      "EMAIL_TAKEN",
      "An account with that email already exists.",
      409,
      { email: ["An account with that email already exists."] },
    );
  }

  return { existingRequestId: existingRequest.id };
}

export async function createCredentialsSignupRequest(
  input: SignUpInput,
  prisma: PrismaClient,
): Promise<SignupRequestCreationResult> {
  const email = input.email.toLowerCase().trim();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const organizationName = input.organization.name.trim();
  const organizationSlug = input.organization.slug ?? null;

  const { existingRequestId } = await assertEmailAvailableForRequest(prisma, email);
  const passwordHash = await hashPassword(input.password);

  if (existingRequestId) {
    const updated = await prisma.signupRequest.update({
      where: { id: existingRequestId },
      data: {
        firstName,
        lastName,
        passwordHash,
        organizationName,
        organizationSlug,
        provider: "credentials",
        status: "pending",
        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,
      },
      select: { id: true, status: true },
    });
    return { requestId: updated.id, status: updated.status };
  }

  const created = await prisma.signupRequest.create({
    data: {
      email,
      firstName,
      lastName,
      passwordHash,
      organizationName,
      organizationSlug,
      provider: "credentials",
    },
    select: { id: true, status: true },
  });

  return { requestId: created.id, status: created.status };
}

export async function createGoogleSignupRequest(
  input: GoogleSignUpInput,
  prisma: PrismaClient,
): Promise<SignupRequestCreationResult> {
  const email = input.email.toLowerCase().trim();
  if (!email) {
    throw new SignUpError(
      "VALIDATION_ERROR",
      "Google account does not include a valid email.",
      400,
      { email: ["Google account does not include a valid email."] },
    );
  }

  const { firstName, lastName } = deriveNameParts(email, input.fullName);
  const organizationName = deriveGoogleOrganizationName(email, input.fullName);

  const { existingRequestId } = await assertEmailAvailableForRequest(prisma, email);

  if (existingRequestId) {
    const updated = await prisma.signupRequest.update({
      where: { id: existingRequestId },
      data: {
        firstName,
        lastName,
        passwordHash: null,
        organizationName,
        organizationSlug: null,
        provider: "google",
        status: "pending",
        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,
      },
      select: { id: true, status: true },
    });
    return { requestId: updated.id, status: updated.status };
  }

  const created = await prisma.signupRequest.create({
    data: {
      email,
      firstName,
      lastName,
      passwordHash: null,
      organizationName,
      organizationSlug: null,
      provider: "google",
    },
    select: { id: true, status: true },
  });

  return { requestId: created.id, status: created.status };
}

export async function hasPendingSignupRequestForEmail(
  prisma: PrismaClient,
  email: string,
): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return false;
  const row = await prisma.signupRequest.findUnique({
    where: { email: normalized },
    select: { status: true },
  });
  return row?.status === "pending";
}

export type ApprovedSignupResult = {
  userId: string;
  organizationId: string;
  organizationSlug: string;
  organizationRole: OrgRole;
};

export async function approveSignupRequest(
  requestId: string,
  reviewerId: string,
  prisma: PrismaClient,
): Promise<ApprovedSignupResult> {
  const request = await prisma.signupRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      passwordHash: true,
      organizationName: true,
      organizationSlug: true,
      provider: true,
      status: true,
    },
  });

  if (!request) {
    throw new SignUpError(
      "REQUEST_NOT_FOUND",
      "Signup request not found.",
      404,
    );
  }

  if (request.status !== "pending") {
    throw new SignUpError(
      "REQUEST_NOT_PENDING",
      `This signup request is already ${request.status}.`,
      409,
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: request.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new SignUpError(
      "EMAIL_TAKEN",
      "An account with that email already exists.",
      409,
    );
  }

  const displayName = `${request.firstName} ${request.lastName}`.trim();
  const baseSlug = createSlugCandidate(
    request.organizationName,
    request.organizationSlug ?? undefined,
  );
  const passwordHash =
    request.passwordHash ?? (await hashPassword(randomBytes(48).toString("hex")));
  const autoCode = generateBetaCode();

  const license = await provisionLicense(request.email, displayName);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: request.email,
          fullName: displayName,
          passwordHash,
          isActive: true,
        },
        select: { id: true },
      });

      const slug = await generateUniqueOrganizationSlug(tx, baseSlug);
      const organization = await tx.organization.create({
        data: {
          name: request.organizationName,
          slug,
          createdBy: { connect: { id: user.id } },
          keygenUserId: license.keygenUserId,
          keygenLicenseId: license.keygenLicenseId,
          ...license.quotas,
        },
        select: { id: true, slug: true },
      });

      await tx.organizationMember.create({
        data: {
          organization: { connect: { id: organization.id } },
          user: { connect: { id: user.id } },
          role: "owner",
        },
      });

      await tx.betaCode.create({
        data: {
          code: autoCode,
          email: request.email,
          usedBy: { connect: { id: user.id } },
          usedAt: new Date(),
        },
      });

      await tx.signupRequest.update({
        where: { id: request.id },
        data: {
          status: "approved",
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });

      return {
        userId: user.id,
        organizationId: organization.id,
        organizationSlug: organization.slug,
        organizationRole: "owner" as const,
      };
    });
  } catch (err) {
    await rollbackKeygen(license.keygenUserId, license.keygenLicenseId);
    throw err;
  }
}

export type RejectedSignupResult = {
  requestId: string;
  status: SignupRequestStatus;
};

export async function rejectSignupRequest(
  requestId: string,
  reviewerId: string,
  reason: string | null,
  prisma: PrismaClient,
): Promise<RejectedSignupResult> {
  const request = await prisma.signupRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true },
  });

  if (!request) {
    throw new SignUpError(
      "REQUEST_NOT_FOUND",
      "Signup request not found.",
      404,
    );
  }

  if (request.status !== "pending") {
    throw new SignUpError(
      "REQUEST_NOT_PENDING",
      `This signup request is already ${request.status}.`,
      409,
    );
  }

  const trimmed = reason?.trim();
  const updated = await prisma.signupRequest.update({
    where: { id: request.id },
    data: {
      status: "rejected",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      rejectionReason: trimmed ? trimmed : null,
    },
    select: { id: true, status: true },
  });

  return { requestId: updated.id, status: updated.status };
}

export type SignupRequestProviderType = SignupRequestProvider;
export type SignupRequestStatusType = SignupRequestStatus;

// ─────────────────────────────────────────────────────────────
// Invite-based signup (skips super admin approval)
// ─────────────────────────────────────────────────────────────

export type InviteSignupResult = {
  userId: string;
  organizationId: string;
  organizationSlug: string;
  organizationRole: OrgRole;
};

function mapInviteErrorToSignUpError(err: InviteError): SignUpError {
  const message = err.message;
  const code: SignUpErrorCode =
    err.code === "INVITE_NOT_FOUND"
      ? "INVITE_NOT_FOUND"
      : err.code === "INVITE_EXPIRED"
        ? "INVITE_EXPIRED"
        : err.code === "INVITE_EMAIL_MISMATCH"
          ? "INVITE_EMAIL_MISMATCH"
          : err.code === "INVITE_NOT_PENDING"
            ? "INVITE_NOT_PENDING"
            : "VALIDATION_ERROR";
  return new SignUpError(code, message, err.status);
}

/**
 * Create a user directly from an invite. No super admin approval, no license
 * provisioning — the user simply joins the inviter's existing organization.
 *
 * Runs in a transaction so user creation, membership, and invite consumption
 * either all succeed or all fail together.
 */
export async function createUserFromInvite(
  input: SignUpInput,
  inviteToken: string,
  prisma: PrismaClient,
): Promise<InviteSignupResult> {
  const email = input.email.toLowerCase().trim();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.$transaction(async (tx) => {
      const invite = await readPendingInviteForSignup(inviteToken, email, tx);

      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existingUser) {
        throw new SignUpError(
          "EMAIL_TAKEN",
          "An account with that email already exists.",
          409,
          { email: ["An account with that email already exists."] },
        );
      }

      const user = await tx.user.create({
        data: {
          email,
          fullName: `${firstName} ${lastName}`.trim(),
          passwordHash,
          isActive: true,
        },
        select: { id: true },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: invite.organizationId,
          userId: user.id,
          role: invite.role,
        },
      });

      await markInviteConsumed(invite.id, user.id, tx);

      return {
        userId: user.id,
        organizationId: invite.organizationId,
        organizationSlug: invite.organizationSlug,
        organizationRole: invite.role,
      };
    });
  } catch (err) {
    if (err instanceof SignUpError) throw err;
    if (err instanceof InviteError) throw mapInviteErrorToSignUpError(err);
    throw err;
  }
}
