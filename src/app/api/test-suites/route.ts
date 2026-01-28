import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
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

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDisplayOrder(value?: number | null) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const testPlanId = searchParams.get("testPlanId")?.trim();
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

  const filters: Prisma.TestSuiteWhereInput[] = [];
  if (testPlanId) {
    filters.push({ testPlanId });
  }
  if (projectId) {
    filters.push({ testPlan: { projectId } });
  }
  if (query) {
    filters.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { testPlan: { name: { contains: query, mode: "insensitive" } } },
        { testPlan: { project: { name: { contains: query, mode: "insensitive" } } } },
        { testPlan: { project: { key: { contains: query, mode: "insensitive" } } } },
        { parent: { name: { contains: query, mode: "insensitive" } } },
      ],
    });
  }
  if (!isGlobalAdmin && !isGlobalReadOnly) {
    filters.push({
      testPlan: {
        project: {
          members: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });
  }

  const where: Prisma.TestSuiteWhereInput = filters.length
    ? { AND: filters }
    : {};

  const [items, total] = await prisma.$transaction([
    prisma.testSuite.findMany({
      where,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        testPlan: {
          select: {
            id: true,
            name: true,
            project: {
              select: {
                id: true,
                key: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.testSuite.count({ where }),
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
      testPlanId?: string;
      parentSuiteId?: string | null;
      name?: string;
      description?: string | null;
      displayOrder?: number | null;
    };

    const testPlanId = body.testPlanId?.trim();
    const parentSuiteId = body.parentSuiteId?.trim() || null;
    const name = body.name?.trim();

    if (!testPlanId || !name) {
      return NextResponse.json(
        { message: "Plan y nombre son requeridos." },
        { status: 400 },
      );
    }

    const plan = await prisma.testPlan.findUnique({
      where: { id: testPlanId },
      select: { projectId: true },
    });

    if (!plan) {
      return NextResponse.json(
        { message: "Plan no encontrado." },
        { status: 404 },
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
      const role = await getProjectRole(session.user.id, plan.projectId);
      if (!hasProjectPermission(role, "editor")) {
        return NextResponse.json(
          { message: "No tienes permisos para crear suites." },
          { status: 403 },
        );
      }
    }

    if (parentSuiteId) {
      const parent = await prisma.testSuite.findUnique({
        where: { id: parentSuiteId },
        select: { id: true, testPlanId: true },
      });
      if (!parent || parent.testPlanId !== testPlanId) {
        return NextResponse.json(
          { message: "Suite padre inválida." },
          { status: 400 },
        );
      }
    }

    const suite = await prisma.testSuite.create({
      data: {
        testPlanId,
        parentSuiteId,
        name,
        description: body.description?.trim() || null,
        displayOrder: parseDisplayOrder(body.displayOrder),
      },
    });

    return NextResponse.json(suite, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Ya existe una suite con ese nombre en el plan." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo crear la suite." },
      { status: 500 },
    );
  }
}
