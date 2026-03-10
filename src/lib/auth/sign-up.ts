import { hash } from "bcryptjs";
import type { OrgRole, PrismaClient } from "@/generated/prisma/client";
import { normalizeSlug, type SignUpInput } from "@/lib/schemas/sign-up";

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
        createdById: user.id,
      },
      select: { id: true, slug: true },
    });

    await tx.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: "owner",
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
