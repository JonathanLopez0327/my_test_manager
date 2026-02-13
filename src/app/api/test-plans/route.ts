import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, TestPlanStatus } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can, require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

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

export const GET = withAuth(PERMISSIONS.TEST_PLAN_LIST, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
  const { searchParams } = new URL(req.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const query = searchParams.get("query")?.trim();
  const projectId = searchParams.get("projectId")?.trim();

  if (projectId) {
    const allowed = await can(PERMISSIONS.TEST_PLAN_LIST, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId,
    });
    if (!allowed) {
      return NextResponse.json(
        { message: "No tienes acceso a este proyecto." },
        { status: 403 },
      );
    }
  }

  const filters: Prisma.TestPlanWhereInput[] = [];

  // Scope to active organization
  if (activeOrganizationId) {
    filters.push({ project: { organizationId: activeOrganizationId } });
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
  // Org owner/admin can see all plans in their org; others need explicit membership
  if (!organizationRole || (organizationRole !== "owner" && organizationRole !== "admin")) {
    filters.push({
      project: {
        members: {
          some: { userId },
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
          select: { id: true, key: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.testPlan.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
});

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
  try {
    const body = (await req.json()) as {
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

    await requirePerm(PERMISSIONS.TEST_PLAN_CREATE, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId,
    });

    const plan = await prisma.testPlan.create({
      data: {
        projectId,
        name,
        description: body.description?.trim() || null,
        status,
        startsOn,
        endsOn,
        createdById: userId,
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
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
});
