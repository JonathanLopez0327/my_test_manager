import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

export const GET = withAuth(null, async (_req, { userId, globalRoles, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: { select: { members: true, projects: true } },
      createdBy: { select: { id: true, fullName: true, email: true } },
    },
  });

  if (!org) {
    return NextResponse.json(
      { message: "Organization not found." },
      { status: 404 },
    );
  }

  // Check if user is a member or has global access
  const allowed = await can(PERMISSIONS.ORG_LIST, {
    userId,
    globalRoles,
    organizationId: id,
    organizationRole,
  });

  if (!allowed) {
    // Check direct membership
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: id, userId } },
    });
    if (!membership) {
      return NextResponse.json(
        { message: "You do not have access to this organization." },
        { status: 403 },
      );
    }
  }

  return NextResponse.json(org);
});

export const PUT = withAuth(null, async (req, { userId, globalRoles, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;

  const allowed = await can(PERMISSIONS.ORG_UPDATE, {
    userId,
    globalRoles,
    organizationId: id,
    organizationRole,
  });

  if (!allowed) {
    return NextResponse.json(
      { message: "You do not have permission to update this organization." },
      { status: 403 },
    );
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      slug?: string;
      isActive?: boolean;
      maxProjects?: number;
      maxMembers?: number;
      maxTestCases?: number;
      maxTestRuns?: number;
      betaExpiresAt?: string | null;
    };

    const data: Prisma.OrganizationUpdateInput = {};

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { message: "The name cannot be empty." },
          { status: 400 },
        );
      }
      data.name = name;
    }

    if (body.slug !== undefined) {
      const slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (slug.length < 3 || slug.length > 50) {
        return NextResponse.json(
          { message: "The slug must have between 3 and 50 characters." },
          { status: 400 },
        );
      }
      data.slug = slug;
    }

    if (body.isActive !== undefined) {
      data.isActive = body.isActive;
    }

    const isSuperAdmin = globalRoles.includes("super_admin");
    if (isSuperAdmin) {
      const quotaFields = ["maxProjects", "maxMembers", "maxTestCases", "maxTestRuns"] as const;
      for (const field of quotaFields) {
        if (body[field] !== undefined) {
          const val = Number(body[field]);
          if (!Number.isInteger(val) || val < 0) {
            return NextResponse.json({ message: `${field} must be a non-negative integer.` }, { status: 400 });
          }
          data[field] = val;
        }
      }

      if (body.betaExpiresAt !== undefined) {
        if (body.betaExpiresAt === null) {
          data.betaExpiresAt = null;
        } else {
          const d = new Date(body.betaExpiresAt);
          if (isNaN(d.getTime())) {
            return NextResponse.json({ message: "betaExpiresAt must be a valid date." }, { status: 400 });
          }
          data.betaExpiresAt = d;
        }
      }
    }

    const org = await prisma.organization.update({
      where: { id },
      data,
    });

    return NextResponse.json(org);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "An organization with that slug already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "Could not update the organization." },
      { status: 500 },
    );
  }
});

export const DELETE = withAuth(null, async (_req, { userId, globalRoles, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;

  const allowed = await can(PERMISSIONS.ORG_DELETE, {
    userId,
    globalRoles,
    organizationId: id,
    organizationRole,
  });

  if (!allowed) {
    return NextResponse.json(
      { message: "You do not have permission to delete this organization." },
      { status: 403 },
    );
  }

  try {
    await prisma.organization.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "Could not delete the organization." },
      { status: 500 },
    );
  }
});


