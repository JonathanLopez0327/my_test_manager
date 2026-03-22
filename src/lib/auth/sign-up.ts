import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import type { OrgRole, PrismaClient } from "@/generated/prisma/client";
import { normalizeSlug, type SignUpInput } from "@/lib/schemas/sign-up";
import { generateBetaCode } from "@/lib/beta/generate-code";

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

export type SignUpSuccessResult = {
  userId: string;
  organizationId: string;
  organizationSlug: string;
  organizationRole: OrgRole;
};

type OAuthSignUpInput = {
  email: string;
  fullName?: string | null;
};

export type OAuthSignUpResult = {
  userId: string;
  created: boolean;
};

export async function registerUserWithOrganization(
  input: SignUpInput,
  prisma: PrismaClient,
): Promise<SignUpSuccessResult> {
  const email = input.email.toLowerCase().trim();
  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
  const baseSlug = createSlugCandidate(
    input.organization.name,
    input.organization.slug,
  );

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

  const passwordHash = await hash(input.password, 10);
  const autoCode = generateBetaCode();

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        isActive: true,
      },
      select: { id: true },
    });

    const slug = await generateUniqueOrganizationSlug(tx, baseSlug);
    const organization = await tx.organization.create({
      data: {
        name: input.organization.name.trim(),
        slug,
        createdBy: { connect: { id: user.id } },
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
        email,
        usedBy: { connect: { id: user.id } },
        usedAt: new Date(),
      },
    });

    return {
      userId: user.id,
      organizationId: organization.id,
      organizationSlug: organization.slug,
      organizationRole: "owner" as const,
    };
  });

  return created;
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

export async function registerGoogleUserWithOrganization(
  input: OAuthSignUpInput,
  prisma: PrismaClient,
): Promise<OAuthSignUpResult> {
  const email = input.email.toLowerCase().trim();
  if (!email) {
    throw new SignUpError(
      "VALIDATION_ERROR",
      "Google account does not include a valid email.",
      400,
      { email: ["Google account does not include a valid email."] },
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });

  if (existingUser?.isActive === false) {
    throw new SignUpError(
      "UNKNOWN_ERROR",
      "This account is disabled. Contact support.",
      403,
    );
  }

  if (existingUser?.id) {
    return {
      userId: existingUser.id,
      created: false,
    };
  }

  const displayName = deriveDisplayName(email, input.fullName);
  const organizationName = deriveGoogleOrganizationName(email, input.fullName);
  const baseSlug = createSlugCandidate(organizationName);
  const technicalPasswordHash = await hash(randomBytes(48).toString("hex"), 10);
  const autoCode = generateBetaCode();

  const createdUserId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        fullName: displayName,
        passwordHash: technicalPasswordHash,
        isActive: true,
      },
      select: { id: true },
    });

    const slug = await generateUniqueOrganizationSlug(tx, baseSlug);

    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        slug,
        createdBy: { connect: { id: user.id } },
      },
      select: { id: true },
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
        email,
        usedBy: { connect: { id: user.id } },
        usedAt: new Date(),
      },
    });

    return user.id;
  });

  return {
    userId: createdUserId,
    created: true,
  };
}
