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
      { message: "Organización no encontrada." },
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
        { message: "No tienes acceso a esta organización." },
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
      { message: "No tienes permisos para actualizar esta organización." },
      { status: 403 },
    );
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      slug?: string;
      isActive?: boolean;
    };

    const data: Prisma.OrganizationUpdateInput = {};

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { message: "El nombre no puede estar vacío." },
          { status: 400 },
        );
      }
      data.name = name;
    }

    if (body.slug !== undefined) {
      const slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (slug.length < 3 || slug.length > 50) {
        return NextResponse.json(
          { message: "El slug debe tener entre 3 y 50 caracteres." },
          { status: 400 },
        );
      }
      data.slug = slug;
    }

    if (body.isActive !== undefined) {
      data.isActive = body.isActive;
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
        { message: "Ya existe una organización con ese slug." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo actualizar la organización." },
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
      { message: "No tienes permisos para eliminar esta organización." },
      { status: 403 },
    );
  }

  try {
    await prisma.organization.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "No se pudo eliminar la organización." },
      { status: 500 },
    );
  }
});
