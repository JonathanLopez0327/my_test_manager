import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, OrgRole } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

const VALID_ROLES: OrgRole[] = ["owner", "admin", "member", "billing"];

export const GET = withAuth(null, async (_req, { userId, globalRoles, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;

  const allowed = await can(PERMISSIONS.ORG_MEMBER_LIST, {
    userId,
    globalRoles,
    organizationId: id,
    organizationRole,
  });

  if (!allowed) {
    return NextResponse.json(
      { message: "No tienes acceso a los miembros de esta organización." },
      { status: 403 },
    );
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
    orderBy: { createdAt: "asc" },
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
      { message: "No tienes permisos para gestionar miembros." },
      { status: 403 },
    );
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
        { message: "El ID del usuario es requerido." },
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
        { message: "Usuario no encontrado." },
        { status: 404 },
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
        { message: "El usuario ya es miembro de esta organización." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo agregar el miembro." },
      { status: 500 },
    );
  }
});
