import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can, require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";
import { anyGlobalRoleHasPermission } from "@/lib/auth/role-permissions.map";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const GET = withAuth(null, async (req, { userId, globalRoles }) => {
  const { searchParams } = new URL(req.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const query = searchParams.get("query")?.trim();

  const hasGlobalListAccess = anyGlobalRoleHasPermission(
    globalRoles,
    PERMISSIONS.PROJECT_LIST,
  );

  const filters: Prisma.ProjectWhereInput[] = [];
  if (query) {
    filters.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { key: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    });
  }
  if (!hasGlobalListAccess) {
    filters.push({
      members: {
        some: {
          userId,
        },
      },
    });
  }

  const where: Prisma.ProjectWhereInput = filters.length
    ? { AND: filters }
    : {};

  const [items, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.project.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
  });
});

export const POST = withAuth(null, async (req, { userId, globalRoles }) => {
  const allowed = await can(PERMISSIONS.PROJECT_CREATE, {
    userId,
    globalRoles,
  });
  if (!allowed) {
    return NextResponse.json(
      { message: "No tienes permisos para crear proyectos." },
      { status: 403 },
    );
  }

  try {
    const body = (await req.json()) as {
      key?: string;
      name?: string;
      description?: string | null;
      isActive?: boolean;
    };

    const key = body.key?.trim().toUpperCase();
    const name = body.name?.trim();

    if (!key || !name) {
      return NextResponse.json(
        { message: "Key y nombre son requeridos." },
        { status: 400 },
      );
    }

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          key,
          name,
          description: body.description?.trim() || null,
          isActive: body.isActive ?? true,
          createdById: userId,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: created.id,
          userId,
          role: "admin",
        },
      });

      return created;
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Ya existe un proyecto con ese key." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo crear el proyecto." },
      { status: 500 },
    );
  }
});
