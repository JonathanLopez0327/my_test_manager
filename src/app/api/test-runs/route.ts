import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { Prisma, TestRunStatus, TestRunType } from "@/generated/prisma/client";
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
  const projectId = searchParams.get("projectId")?.trim();
  const testPlanId = searchParams.get("testPlanId")?.trim();
  const suiteId = searchParams.get("suiteId")?.trim();
  const status = parseStatus(searchParams.get("status")?.trim() ?? null);
  const runType = parseRunType(searchParams.get("runType")?.trim() ?? null);

  if (projectId && !isGlobalAdmin && !isGlobalReadOnly) {
    const role = await getProjectRole(session.user.id, projectId);
    if (!role) {
      return NextResponse.json(
        { message: "No tienes acceso a este proyecto." },
        { status: 403 },
      );
    }
  }

  const filters: Prisma.TestRunWhereInput[] = [];
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

  const where: Prisma.TestRunWhereInput = filters.length
    ? { AND: filters }
    : {};

  const [items, total] = await prisma.$transaction([
    prisma.testRun.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
        testPlan: {
          select: {
            id: true,
            name: true,
          },
        },
        suite: {
          select: {
            id: true,
            name: true,
            testPlan: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        triggeredBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.testRun.count({ where }),
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
          { message: "No tienes permisos para crear runs." },
          { status: 403 },
        );
      }
    }

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

    const run = await prisma.testRun.create({
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
        triggeredById: session.user.id,
      },
    });

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: "No se pudo crear el run." },
      { status: 500 },
    );
  }
}
