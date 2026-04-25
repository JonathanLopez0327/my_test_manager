import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";
import { generateApiToken } from "@/lib/auth/api-token";

const MAX_TOKEN_TTL_DAYS = 365;
const MAX_ACTIVE_TOKENS_PER_USER = 20;

const createApiTokenSchema = z.object({
  name: z.string().trim().min(3).max(80),
  organizationId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const GET = withAuth(null, async (_req, { userId }) => {
  const items = await prisma.apiToken.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      organizationId: true,
      isActive: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      organization: {
        select: {
          id: true,
          slug: true,
          name: true,
          isActive: true,
        },
      },
    },
  });

  return NextResponse.json({ items });
});

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
  const parsed = createApiTokenSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const isSuperAdmin = globalRoles.includes("super_admin");
  const requestedOrgId = parsed.data.organizationId;
  const targetOrganizationId = requestedOrgId ?? activeOrganizationId;

  if (!isSuperAdmin && !targetOrganizationId) {
    return NextResponse.json(
      { message: "You must provide an organizationId or have an active organization." },
      { status: 400 },
    );
  }

  if (targetOrganizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: targetOrganizationId },
      select: { id: true, isActive: true },
    });

    if (!organization) {
      return NextResponse.json(
        { message: "Organization not found." },
        { status: 404 },
      );
    }

    if (!organization.isActive) {
      return NextResponse.json(
        { message: "The organization is not active." },
        { status: 403 },
      );
    }

    if (!isSuperAdmin) {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: targetOrganizationId,
            userId,
          },
        },
        select: { userId: true, role: true },
      });

      if (!membership) {
        return NextResponse.json(
          { message: "You cannot issue tokens for this organization." },
          { status: 403 },
        );
      }

      // Issuing a long-lived bearer credential should not be available to
      // every authenticated member. Limit to roles that can already manage
      // org-level resources (owner / admin), matching the gate used for
      // ORG_INVITE_MANAGE.
      const effectiveRole = membership.role ?? organizationRole;
      if (effectiveRole !== "owner" && effectiveRole !== "admin") {
        return NextResponse.json(
          { message: "You do not have permission to issue API tokens." },
          { status: 403 },
        );
      }
    }
  }

  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  const now = new Date();
  if (expiresAt && expiresAt <= now) {
    return NextResponse.json(
      { message: "expiresAt must be a future date." },
      { status: 400 },
    );
  }

  // Cap token lifetime so a misuse (or a leaked token) has a bounded blast
  // radius. Callers that omit expiresAt get the cap applied automatically.
  const maxExpiresAt = new Date(now.getTime() + MAX_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  if (expiresAt && expiresAt > maxExpiresAt) {
    return NextResponse.json(
      { message: `expiresAt must be within ${MAX_TOKEN_TTL_DAYS} days from now.` },
      { status: 400 },
    );
  }
  const effectiveExpiresAt = expiresAt ?? maxExpiresAt;

  // Cap the number of active tokens per user to prevent unbounded
  // accumulation that complicates incident response and rotation.
  const activeCount = await prisma.apiToken.count({
    where: {
      userId,
      isActive: true,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
  if (activeCount >= MAX_ACTIVE_TOKENS_PER_USER) {
    return NextResponse.json(
      {
        message: `You already have ${MAX_ACTIVE_TOKENS_PER_USER} active tokens. Revoke one before creating another.`,
      },
      { status: 409 },
    );
  }

  const generated = generateApiToken();
  const created = await prisma.apiToken.create({
    data: {
      name: parsed.data.name,
      tokenPrefix: generated.tokenPrefix,
      tokenHash: generated.tokenHash,
      user: { connect: { id: userId } },
      ...(targetOrganizationId ? { organization: { connect: { id: targetOrganizationId } } } : {}),
      expiresAt: effectiveExpiresAt,
    },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      organizationId: true,
      isActive: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });

  return NextResponse.json(
    {
      item: created,
      token: generated.token,
    },
    { status: 201 },
  );
});



