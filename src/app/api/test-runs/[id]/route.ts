import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TestRunStatus, TestRunType } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

const STATUS_VALUES: TestRunStatus[] = [
  "queued",
  "running",
  "completed",
  "canceled",
  "failed",
];
const TYPE_VALUES: TestRunType[] = ["manual", "automated"];

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

export const PUT = withAuth(null, async (req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;

  try {
    const existing = await prisma.testRun.findUnique({
      where: { id },
      select: { projectId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Run no encontrado." },
        { status: 404 },
      );
    }

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

    // Check permission on current project
    await requirePerm(PERMISSIONS.TEST_RUN_UPDATE, {
      userId,
      globalRoles,
      projectId: existing.projectId,
    });

    // If moving to a different project, check permission there too
    if (projectId !== existing.projectId) {
      await requirePerm(PERMISSIONS.TEST_RUN_UPDATE, {
        userId,
        globalRoles,
        projectId,
      });
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

    const run = await prisma.testRun.update({
      where: { id },
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
      },
    });

    return NextResponse.json(run);
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "No se pudo actualizar el run." },
      { status: 500 },
    );
  }
});

export const DELETE = withAuth(null, async (_req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;

  try {
    const existing = await prisma.testRun.findUnique({
      where: { id },
      select: { projectId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Run no encontrado." },
        { status: 404 },
      );
    }

    await requirePerm(PERMISSIONS.TEST_RUN_DELETE, {
      userId,
      globalRoles,
      projectId: existing.projectId,
    });

    await prisma.testRun.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "No se pudo eliminar el run." },
      { status: 500 },
    );
  }
});
