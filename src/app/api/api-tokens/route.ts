import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";
import { generateApiToken } from "@/lib/auth/api-token";

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

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId }) => {
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
        select: { userId: true },
      });

      if (!membership) {
        return NextResponse.json(
          { message: "You cannot issue tokens for this organization." },
          { status: 403 },
        );
      }
    }
  }

  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  if (expiresAt && expiresAt <= new Date()) {
    return NextResponse.json(
      { message: "expiresAt must be a future date." },
      { status: 400 },
    );
  }

  const generated = generateApiToken();
  const created = await prisma.apiToken.create({
    data: {
      name: parsed.data.name,
      tokenPrefix: generated.tokenPrefix,
      tokenHash: generated.tokenHash,
      userId,
      organizationId: targetOrganizationId,
      expiresAt,
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



