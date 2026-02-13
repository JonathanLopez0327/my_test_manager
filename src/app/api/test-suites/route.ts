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

function parseDisplayOrder(value?: number | null) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const GET = withAuth(PERMISSIONS.TEST_SUITE_LIST, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
  const { searchParams } = new URL(req.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const query = searchParams.get("query")?.trim();
  const testPlanId = searchParams.get("testPlanId")?.trim();
  const projectId = searchParams.get("projectId")?.trim();

  if (projectId) {
    const allowed = await can(PERMISSIONS.TEST_SUITE_LIST, {
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

  const filters: Prisma.TestSuiteWhereInput[] = [];

  // Scope to active organization
  if (activeOrganizationId) {
    filters.push({ testPlan: { project: { organizationId: activeOrganizationId } } });
  }

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
  // Org owner/admin can see all suites in their org; others need explicit membership
  if (!organizationRole || (organizationRole !== "owner" && organizationRole !== "admin")) {
    filters.push({
      testPlan: {
        project: {
          members: {
            some: { userId },
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
          select: { id: true, name: true },
        },
        testPlan: {
          select: {
            id: true,
            name: true,
            project: {
              select: { id: true, key: true, name: true },
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

  return NextResponse.json({ items, total, page, pageSize });
});

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
  try {
    const body = (await req.json()) as {
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

    await requirePerm(PERMISSIONS.TEST_SUITE_CREATE, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId: plan.projectId,
    });

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
    if (error instanceof AuthorizationError) throw error;
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
});
