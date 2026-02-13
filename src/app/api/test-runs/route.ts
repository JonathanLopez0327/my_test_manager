import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, TestRunStatus, TestRunType } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can, require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";
import { serializeRunMetrics, upsertRunMetrics } from "@/lib/test-runs";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const STATUS_VALUES: TestRunStatus[] = [
  "queued",
  "running",
  "completed",
  "canceled",
  "failed",
];
const TYPE_VALUES: TestRunType[] = ["manual", "automated"];

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStatus(value?: string | null) {
  if (!value) return null;
  return STATUS_VALUES.includes(value as TestRunStatus)
    ? (value as TestRunStatus)
    : null;
}

function parseRunType(value?: string | null) {
  if (!value) return null;
  return TYPE_VALUES.includes(value as TestRunType)
    ? (value as TestRunType)
    : null;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const GET = withAuth(PERMISSIONS.TEST_RUN_LIST, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
  const { searchParams } = new URL(req.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const query = searchParams.get("query")?.trim();
  const projectId = searchParams.get("projectId")?.trim();
  const testPlanId = searchParams.get("testPlanId")?.trim();
  const suiteId = searchParams.get("suiteId")?.trim();
  const status = parseStatus(searchParams.get("status")?.trim() ?? null);
  const runType = parseRunType(searchParams.get("runType")?.trim() ?? null);

  if (projectId) {
    const allowed = await can(PERMISSIONS.TEST_RUN_LIST, {
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

  const filters: Prisma.TestRunWhereInput[] = [];

  // Scope to active organization
  if (activeOrganizationId) {
    filters.push({ project: { organizationId: activeOrganizationId } });
  }

  if (projectId) {
    filters.push({ projectId });
  }
  if (testPlanId) {
    filters.push({ testPlanId });
  }
  if (suiteId) {
    filters.push({ suiteId });
  }
  if (status) {
    filters.push({ status });
  }
  if (runType) {
    filters.push({ runType });
  }
  if (query) {
    filters.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { environment: { contains: query, mode: "insensitive" } },
        { buildNumber: { contains: query, mode: "insensitive" } },
        { branch: { contains: query, mode: "insensitive" } },
        { commitSha: { contains: query, mode: "insensitive" } },
        { ciProvider: { contains: query, mode: "insensitive" } },
        { project: { name: { contains: query, mode: "insensitive" } } },
        { project: { key: { contains: query, mode: "insensitive" } } },
        { testPlan: { name: { contains: query, mode: "insensitive" } } },
        { suite: { name: { contains: query, mode: "insensitive" } } },
      ],
    });
  }
  // Org owner/admin can see all runs in their org; others need explicit membership
  if (!organizationRole || (organizationRole !== "owner" && organizationRole !== "admin")) {
    filters.push({
      project: {
        members: {
          some: { userId },
        },
      },
    });
  }

  const where: Prisma.TestRunWhereInput = filters.length
    ? { AND: filters }
    : {};

  const [items, total] = await prisma.$transaction([
    prisma.testRun.findMany({
      where,
      include: {
        project: {
          select: { id: true, key: true, name: true },
        },
        testPlan: {
          select: { id: true, name: true },
        },
        suite: {
          select: {
            id: true,
            name: true,
            testPlan: {
              select: { id: true, name: true },
            },
          },
        },
        triggeredBy: {
          select: { id: true, fullName: true, email: true },
        },
        metrics: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.testRun.count({ where }),
  ]);

  const normalizedItems = items.map((run) => ({
    ...run,
    metrics: run.metrics ? serializeRunMetrics(run.metrics) : null,
  }));

  return NextResponse.json({
    items: normalizedItems,
    total,
    page,
    pageSize,
  });
});

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
  try {
    const body = (await req.json()) as {
      projectId?: string;
      testPlanId?: string | null;
      suiteId?: string | null;
      runType?: TestRunType;
      status?: TestRunStatus;
      name?: string | null;
      environment?: string | null;
      buildNumber?: string | null;
      branch?: string | null;
      commitSha?: string | null;
      ciProvider?: string | null;
      ciRunUrl?: string | null;
      startedAt?: string | null;
      finishedAt?: string | null;
      createItems?: boolean;
    };

    const projectId = body.projectId?.trim();
    const testPlanId = body.testPlanId?.trim() || null;
    const suiteId = body.suiteId?.trim() || null;
    const runType = parseRunType(body.runType ?? null);
    const status = parseStatus(body.status ?? null) ?? "queued";
    const startedAt = parseDate(body.startedAt ?? null);
    const finishedAt = parseDate(body.finishedAt ?? null);

    if (!projectId || !runType) {
      return NextResponse.json(
        { message: "Proyecto y tipo son requeridos." },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { message: "Proyecto no encontrado." },
        { status: 404 },
      );
    }

    await requirePerm(PERMISSIONS.TEST_RUN_CREATE, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId,
    });

    if (body.startedAt && !startedAt) {
      return NextResponse.json(
        { message: "Fecha de inicio inválida." },
        { status: 400 },
      );
    }

    if (body.finishedAt && !finishedAt) {
      return NextResponse.json(
        { message: "Fecha de fin inválida." },
        { status: 400 },
      );
    }

    if (startedAt && finishedAt && finishedAt < startedAt) {
      return NextResponse.json(
        { message: "La fecha de fin debe ser posterior a la fecha de inicio." },
        { status: 400 },
      );
    }

    let resolvedPlanId = testPlanId;

    if (testPlanId) {
      const plan = await prisma.testPlan.findUnique({
        where: { id: testPlanId },
        select: { id: true, projectId: true },
      });
      if (!plan) {
        return NextResponse.json(
          { message: "Plan no encontrado." },
          { status: 404 },
        );
      }
      if (plan.projectId !== projectId) {
        return NextResponse.json(
          { message: "El plan no pertenece al proyecto." },
          { status: 400 },
        );
      }
    }

    if (suiteId) {
      const suite = await prisma.testSuite.findUnique({
        where: { id: suiteId },
        select: {
          id: true,
          testPlanId: true,
          testPlan: { select: { projectId: true } },
        },
      });
      if (!suite) {
        return NextResponse.json(
          { message: "Suite no encontrada." },
          { status: 404 },
        );
      }
      if (suite.testPlan.projectId !== projectId) {
        return NextResponse.json(
          { message: "La suite no pertenece al proyecto." },
          { status: 400 },
        );
      }
      if (resolvedPlanId && suite.testPlanId !== resolvedPlanId) {
        return NextResponse.json(
          { message: "La suite no pertenece al plan seleccionado." },
          { status: 400 },
        );
      }
      if (!resolvedPlanId) {
        resolvedPlanId = suite.testPlanId;
      }
    }

    const shouldCreateItems = body.createItems !== false;

    const run = await prisma.$transaction(async (tx) => {
      const createdRun = await tx.testRun.create({
        data: {
          projectId,
          testPlanId: resolvedPlanId,
          suiteId,
          runType,
          status,
          name: body.name?.trim() || null,
          environment: body.environment?.trim() || null,
          buildNumber: body.buildNumber?.trim() || null,
          branch: body.branch?.trim() || null,
          commitSha: body.commitSha?.trim() || null,
          ciProvider: body.ciProvider?.trim() || null,
          ciRunUrl: body.ciRunUrl?.trim() || null,
          startedAt,
          finishedAt,
          triggeredById: userId,
        },
      });

      if (shouldCreateItems && (suiteId || resolvedPlanId)) {
        const testCaseWhere = suiteId
          ? { suiteId }
          : { suite: { testPlanId: resolvedPlanId ?? undefined } };

        const testCases = await tx.testCase.findMany({
          where: testCaseWhere,
          select: { id: true },
        });

        if (testCases.length > 0) {
          await tx.testRunItem.createMany({
            data: testCases.map((testCase) => ({
              runId: createdRun.id,
              testCaseId: testCase.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      await upsertRunMetrics(tx, createdRun.id);

      return createdRun;
    });

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "No se pudo crear el run." },
      { status: 500 },
    );
  }
});
