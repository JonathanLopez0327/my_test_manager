import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { anyGlobalRoleHasPermission } from "@/lib/auth/role-permissions.map";

export const GET = withAuth(null, async (req, { userId, globalRoles }) => {
  const isSuperAdmin = anyGlobalRoleHasPermission(
    globalRoles,
    PERMISSIONS.ORG_LIST,
  );

  const where: Prisma.OrganizationWhereInput = isSuperAdmin
    ? {}
    : { members: { some: { userId } } };

  const items = await prisma.organization.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { members: true, projects: true } },
    },
  });

  return NextResponse.json({ items });
});

export const POST = withAuth(PERMISSIONS.ORG_CREATE, async (req, { userId }) => {
  try {
    const body = (await req.json()) as {
      slug?: string;
      name?: string;
    };

    const slug = body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    const name = body.name?.trim();

    if (!slug || !name) {
      return NextResponse.json(
        { message: "Slug y nombre son requeridos." },
        { status: 400 },
      );
    }

    if (slug.length < 3 || slug.length > 50) {
      return NextResponse.json(
        { message: "El slug debe tener entre 3 y 50 caracteres." },
        { status: 400 },
      );
    }

    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          slug,
          name,
          createdById: userId,
        },
      });

      // Creator becomes owner
      await tx.organizationMember.create({
        data: {
          organizationId: created.id,
          userId,
          role: "owner",
        },
      });

      return created;
    });

    return NextResponse.json(org, { status: 201 });
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
      { message: "No se pudo crear la organización." },
      { status: 500 },
    );
  }
});
