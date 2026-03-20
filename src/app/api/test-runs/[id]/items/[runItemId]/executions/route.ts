import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { parseResultStatus, upsertRunMetrics } from "@/lib/test-runs";
import type { TestCaseStyle, TestResultStatus } from "@/generated/prisma/client";

type StepSnapshot = {
  stepTextSnapshot: string;
  expectedSnapshot: string | null;
};

function parseStepSnapshots(style: TestCaseStyle, steps: unknown): StepSnapshot[] {
  if (!steps) return [];

  if (style === "step_by_step" && Array.isArray(steps)) {
    return steps
      .map((entry) => {
        if (typeof entry === "string") return { stepTextSnapshot: entry, expectedSnapshot: null };
        if (!entry || typeof entry !== "object") return null;
        const value = entry as { step?: unknown; expectedResult?: unknown };
        return {
          stepTextSnapshot: typeof value.step === "string" ? value.step : "",
          expectedSnapshot: typeof value.expectedResult === "string" ? value.expectedResult : null,
        };
      })
      .filter((entry): entry is StepSnapshot => Boolean(entry?.stepTextSnapshot?.trim()));
  }

  if (style === "gherkin" && Array.isArray(steps)) {
    return steps
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const value = entry as { keyword?: unknown; text?: unknown };
        const keyword = typeof value.keyword === "string" ? value.keyword : "";
        const text = typeof value.text === "string" ? value.text : "";
        const line = `${keyword} ${text}`.trim();
        return line ? { stepTextSnapshot: line, expectedSnapshot: null } : null;
      })
      .filter((entry): entry is StepSnapshot => Boolean(entry));
  }

  if (style === "data_driven" && typeof steps === "object" && steps !== null) {
    const value = steps as { template?: unknown };
    if (Array.isArray(value.template)) {
      return value.template
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const row = entry as { keyword?: unknown; text?: unknown };
          const keyword = typeof row.keyword === "string" ? row.keyword : "";
          const text = typeof row.text === "string" ? row.text : "";
          const line = `${keyword} ${text}`.trim();
          return line ? { stepTextSnapshot: line, expectedSnapshot: null } : null;
        })
        .filter((entry): entry is StepSnapshot => Boolean(entry));
    }
  }

  if (style === "api" && typeof steps === "object" && steps !== null) {
    const value = steps as {
      request?: { method?: unknown; endpoint?: unknown };
      expectedResponse?: { status?: unknown };
    };
    const method = typeof value.request?.method === "string" ? value.request.method : "REQUEST";
    const endpoint = typeof value.request?.endpoint === "string" ? value.request.endpoint : "/";
    const expectedStatus = typeof value.expectedResponse?.status === "string" ? value.expectedResponse.status : "N/A";
    return [{ stepTextSnapshot: `${method} ${endpoint}`, expectedSnapshot: `Expected status ${expectedStatus}` }];
  }

  if (Array.isArray(steps)) {
    return steps
      .map((entry) => (typeof entry === "string" ? { stepTextSnapshot: entry, expectedSnapshot: null } : null))
      .filter((entry): entry is StepSnapshot => Boolean(entry?.stepTextSnapshot?.trim()));
  }

  return [];
}

function isLegacyExecutionSchemaError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2022";
}

async function ensureRunItemInRun(runId: string, runItemId: string) {
  try {
    return await prisma.testRunItem.findFirst({
      where: { id: runItemId, runId },
      include: {
        testCase: {
          select: {
            id: true,
            style: true,
            steps: true,
          },
        },
        currentExecution: {
          select: {
            id: true,
            attemptNumber: true,
          },
        },
        executions: {
          orderBy: [{ attemptNumber: "desc" }],
          take: 1,
          select: { attemptNumber: true },
        },
      },
    });
  } catch (error) {
    if (!isLegacyExecutionSchemaError(error)) throw error;

    const legacy = await prisma.testRunItem.findFirst({
      where: { id: runItemId, runId },
      select: {
        id: true,
        runId: true,
        testCaseId: true,
        status: true,
        durationMs: true,
        executedById: true,
        executedAt: true,
        errorMessage: true,
        stacktrace: true,
        createdAt: true,
        testCase: {
          select: {
            id: true,
            style: true,
            steps: true,
          },
        },
      },
    });

    if (!legacy) return null;

    return {
      ...legacy,
      currentExecutionId: null,
      currentExecution: null,
      executions: [],
    };
  }
}

export const GET = withAuth(null, async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id: runId, runItemId } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, runId, PERMISSIONS.TEST_RUN_ITEM_LIST, activeOrganizationId, organizationRole);
  if (access.error) return access.error;

  const runItem = await ensureRunItemInRun(runId, runItemId);
  if (!runItem) {
    return NextResponse.json({ message: "Run item not found." }, { status: 404 });
  }

  let executions: Array<{
    id: string;
    attemptNumber: number;
    status: TestResultStatus;
    startedAt: Date | null;
    completedAt: Date | null;
    durationMs: number | null;
    executedById: string | null;
    summary: string | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
    executedBy: { id: string; fullName: string | null; email: string } | null;
    _count: { stepResults: number; artifacts: number };
  }> = [];

  try {
    executions = await prisma.testRunItemExecution.findMany({
      where: { runItemId },
      orderBy: [{ attemptNumber: "desc" }],
      include: {
        executedBy: {
          select: { id: true, fullName: true, email: true },
        },
        _count: {
          select: { stepResults: true, artifacts: true },
        },
      },
    });
  } catch (error) {
    if (!isLegacyExecutionSchemaError(error)) throw error;
    executions = [];
  }

  return NextResponse.json({
    currentExecutionId: runItem.currentExecutionId,
    items: executions,
  });
});

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id: runId, runItemId } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, runId, PERMISSIONS.TEST_RUN_ITEM_UPDATE, activeOrganizationId, organizationRole);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => ({}))) as {
    status?: TestResultStatus;
    summary?: string | null;
  };

  const runItem = await ensureRunItemInRun(runId, runItemId);
  if (!runItem) {
    return NextResponse.json({ message: "Run item not found." }, { status: 404 });
  }

  const requestedStatus = parseResultStatus(body.status ?? null) ?? "not_run";
  const nextAttemptNumber = (runItem.executions[0]?.attemptNumber ?? 0) + 1;
  const stepSnapshots = parseStepSnapshots(runItem.testCase.style, runItem.testCase.steps);
  const now = new Date();
  const completedAt = requestedStatus === "not_run" || requestedStatus === "in_progress" ? null : now;

  const result = await prisma.$transaction(async (tx) => {
    const execution = await tx.testRunItemExecution.create({
      data: {
        runItemId,
        attemptNumber: nextAttemptNumber,
        status: requestedStatus,
        startedAt: now,
        completedAt,
        executedById: userId,
        summary: body.summary?.trim() || null,
      },
      select: { id: true },
    });

    if (stepSnapshots.length > 0) {
      await tx.testRunItemExecutionStepResult.createMany({
        data: stepSnapshots.map((step, index) => ({
          executionId: execution.id,
          stepIndex: index,
          stepTextSnapshot: step.stepTextSnapshot,
          expectedSnapshot: step.expectedSnapshot,
          status: "not_run",
        })),
      });
    }

    await tx.testRunItem.update({
      where: { id: runItemId },
      data: {
        currentExecutionId: execution.id,
        status: requestedStatus,
        executedAt: completedAt,
        executedById: userId,
        errorMessage: null,
      },
    });

    await upsertRunMetrics(tx, runId);

    return execution;
  });

  return NextResponse.json({ id: result.id, attemptNumber: nextAttemptNumber }, { status: 201 });
});
