import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { Prisma, TestPlanStatus } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import {
  getGlobalRoles,
  getProjectRole,
  hasProjectPermission,
  isReadOnlyGlobal,
  isSuperAdmin,
} from "@/lib/permissions";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const STATUS_VALUES: TestPlanStatus[] = [
  "draft",
  "active",
  "completed",
  "archived",
];

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStatus(value?: string | null) {
  if (!value) return null;
  return STATUS_VALUES.includes(value as TestPlanStatus)
    ? (value as TestPlanStatus)
    : null;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  const status = parseStatus(searchParams.get("status")?.trim() ?? null);
  const projectId = searchParams.get("projectId")?.trim();

  if (projectId && !isGlobalAdmin && !isGlobalReadOnly) {
    const role = await getProjectRole(session.user.id, projectId);
    if (!role) {
      return NextResponse.json(
        { message: "No tienes acceso a este proyecto." },
        { status: 403 },
      );
    }
  }

  const filters: Prisma.TestPlanWhereInput[] = [];
  if (status) {
    filters.push({ status });
  }
  if (projectId) {
    filters.push({ projectId });
  }
  if (query) {
    filters.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { project: { name: { contains: query, mode: "insensitive" } } },
        { project: { key: { contains: query, mode: "insensitive" } } },
      ],
    });
  }
  if (!isGlobalAdmin && !isGlobalReadOnly) {
    filters.push({
      project: {
        members: {
          some: {
            userId: session.user.id,
          },
        },
      },
    });
  }

  const where: Prisma.TestPlanWhereInput = filters.length
    ? { AND: filters }
    : {};

  const [items, total] = await prisma.$transaction([
    prisma.testPlan.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.testPlan.count({ where }),
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
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      projectId?: string;
      name?: string;
      description?: string | null;
      status?: TestPlanStatus;
      startsOn?: string | null;
      endsOn?: string | null;
    };

    const projectId = body.projectId?.trim();
    const name = body.name?.trim();
    const status = parseStatus(body.status ?? null) ?? "draft";
    const startsOn = parseDate(body.startsOn ?? null);
    const endsOn = parseDate(body.endsOn ?? null);

    if (!projectId || !name) {
      return NextResponse.json(
        { message: "Proyecto y nombre son requeridos." },
        { status: 400 },
      );
    }

    const globalRoles = await getGlobalRoles(session.user.id);
    if (!isSuperAdmin(globalRoles)) {
      if (isReadOnlyGlobal(globalRoles)) {
        return NextResponse.json(
          { message: "Solo lectura." },
          { status: 403 },
        );
      }
      const role = await getProjectRole(session.user.id, projectId);
      if (!hasProjectPermission(role, "editor")) {
        return NextResponse.json(
          { message: "No tienes permisos para crear planes." },
          { status: 403 },
        );
      }
    }

    if (body.startsOn && !startsOn) {
      return NextResponse.json(
        { message: "Fecha de inicio inválida." },
        { status: 400 },
      );
    }

    if (body.endsOn && !endsOn) {
      return NextResponse.json(
        { message: "Fecha de fin inválida." },
        { status: 400 },
      );
    }

    if (startsOn && endsOn && endsOn < startsOn) {
      return NextResponse.json(
        { message: "La fecha de fin debe ser posterior a la fecha de inicio." },
        { status: 400 },
      );
    }

    const plan = await prisma.testPlan.create({
      data: {
        projectId,
        name,
        description: body.description?.trim() || null,
        status,
        startsOn,
        endsOn,
        createdById: session.user.id,
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Ya existe un plan con ese nombre en el proyecto." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo crear el plan." },
      { status: 500 },
    );
  }
}
