import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, OrgRole } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";
import { parseSortBy, parseSortDir } from "@/lib/sorting";
import { checkQuota, quotaExceededResponse } from "@/lib/beta/quota";

const VALID_ROLES: OrgRole[] = ["owner", "admin", "member", "billing"];
const SORTABLE_FIELDS = ["name", "email", "role", "isActive"] as const;
type MemberSortBy = (typeof SORTABLE_FIELDS)[number];

export const GET = withAuth(null, async (req, { userId, globalRoles, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;
  const { searchParams } = new URL(req.url);
  const requestedSortBy = searchParams.get("sortBy");
  const sortBy =
    requestedSortBy && SORTABLE_FIELDS.includes(requestedSortBy as MemberSortBy)
      ? parseSortBy<MemberSortBy>(requestedSortBy, SORTABLE_FIELDS, "name")
      : null;
  const sortDir = parseSortDir(searchParams.get("sortDir"), "asc");

  const allowed = await can(PERMISSIONS.ORG_MEMBER_LIST, {
    userId,
    globalRoles,
    organizationId: id,
    organizationRole,
  });

  if (!allowed) {
    return NextResponse.json(
      { message: "You do not have access to this organization's members list." },
      { status: 403 },
    );
  }

  let orderBy: Prisma.OrganizationMemberOrderByWithRelationInput[] = [
    { createdAt: "asc" },
    { userId: "asc" },
  ];

  if (sortBy) {
    switch (sortBy) {
      case "name":
        orderBy = [{ user: { fullName: sortDir } }, { userId: "asc" }];
        break;
      case "email":
        orderBy = [{ user: { email: sortDir } }, { userId: "asc" }];
        break;
      case "role":
        orderBy = [{ role: sortDir }, { userId: "asc" }];
        break;
      case "isActive":
        orderBy = [{ user: { isActive: sortDir } }, { userId: "asc" }];
        break;
    }
  }

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          isActive: true,
        },
      },
    },
    orderBy,
  });

  return NextResponse.json({ items: members });
});

export const POST = withAuth(null, async (req, { userId, globalRoles, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;

  const allowed = await can(PERMISSIONS.ORG_MEMBER_MANAGE, {
    userId,
    globalRoles,
    organizationId: id,
    organizationRole,
  });

  if (!allowed) {
    return NextResponse.json(
      { message: "You do not have permission to manage members." },
      { status: 403 },
    );
  }

  const quota = await checkQuota(prisma, id, "members");
  if (!quota.allowed) {
    return quotaExceededResponse(quota);
  }

  try {
    const body = (await req.json()) as {
      userId?: string;
      role?: OrgRole;
    };

    const targetUserId = body.userId?.trim();
    const role = body.role && VALID_ROLES.includes(body.role) ? body.role : "member";

    if (!targetUserId) {
      return NextResponse.json(
        { message: "El ID del user es requerido." },
        { status: 400 },
      );
    }

    // Verify user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { message: "User no encontrado." },
        { status: 404 },
      );
    }

    // Check if user already belongs to any organization
    const existingMembership = await prisma.organizationMember.findFirst({
      where: { userId: targetUserId },
      select: { organizationId: true },
    });

    if (existingMembership) {
      return NextResponse.json(
        { message: "The user already belongs to an organization. In this version, users can only belong to one organization." },
        { status: 409 },
      );
    }

    const member = await prisma.organizationMember.create({
      data: {
        organizationId: id,
        userId: targetUserId,
        role,
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "El user ya es member de esta organization." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "Could not add the member." },
      { status: 500 },
    );
  }
});


