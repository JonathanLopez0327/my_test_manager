import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can, require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const GET = withAuth(PERMISSIONS.PROJECT_LIST, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
  const { searchParams } = new URL(req.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const query = searchParams.get("query")?.trim();

  const filters: Prisma.ProjectWhereInput[] = [];

  // Scope to active organization
  if (activeOrganizationId) {
    filters.push({ organizationId: activeOrganizationId });
  }

  if (query) {
    filters.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { key: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    });
  }
  // Org owner/admin can see all projects in their org; others need explicit membership
  if (!organizationRole || (organizationRole !== "owner" && organizationRole !== "admin")) {
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

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
  const allowed = await can(PERMISSIONS.PROJECT_CREATE, {
    userId,
    globalRoles,
    organizationId: activeOrganizationId,
    organizationRole,
  });
  if (!allowed) {
    return NextResponse.json(
      { message: "No tienes permisos para crear proyectos." },
      { status: 403 },
    );
  }

  if (!activeOrganizationId) {
    return NextResponse.json(
      { message: "Debes tener una organización activa para crear proyectos." },
      { status: 400 },
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
          organizationId: activeOrganizationId,
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
