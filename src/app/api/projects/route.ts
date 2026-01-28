import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import {
  canCreateProject,
  getGlobalRoles,
  isReadOnlyGlobal,
  isSuperAdmin,
} from "@/lib/permissions";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const globalRoles = await getGlobalRoles(session.user.id);
  const isGlobalAdmin = isSuperAdmin(globalRoles);
  const isGlobalReadOnly = isReadOnlyGlobal(globalRoles);

  const { searchParams } = new URL(request.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const query = searchParams.get("query")?.trim();

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
  if (!isGlobalAdmin && !isGlobalReadOnly) {
    filters.push({
      members: {
        some: {
          userId: session.user.id,
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
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "No autorizado." },
      { status: 401 },
    );
  }

  const globalRoles = await getGlobalRoles(session.user.id);
  const allowed = await canCreateProject(session.user.id, globalRoles);
  if (!allowed) {
    return NextResponse.json(
      { message: "No tienes permisos para crear proyectos." },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as {
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
          createdById: session.user.id,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: created.id,
          userId: session.user.id,
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
}
