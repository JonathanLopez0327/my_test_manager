import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { parseResultStatus, upsertRunMetrics } from "@/lib/test-runs";
import type { TestCaseStyle, TestResultStatus } from "@/generated/prisma/client";
import { ensureRunMutable } from "@/lib/auth/ensure-run-mutable";

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
    return steps.flatMap((entry): StepSnapshot[] => {
      if (!entry || typeof entry !== "object") return [];
      const value = entry as { keyword?: unknown; text?: unknown };
      const keyword = typeof value.keyword === "string" ? value.keyword : "";
      const text = typeof value.text === "string" ? value.text : "";
      const line = `${keyword} ${text}`.trim();
      return line ? [{ stepTextSnapshot: line, expectedSnapshot: null }] : [];
    });
  }

  if (style === "data_driven" && typeof steps === "object" && steps !== null) {
    const value = steps as { template?: unknown };
    if (Array.isArray(value.template)) {
      return value.template.flatMap((entry): StepSnapshot[] => {
        if (!entry || typeof entry !== "object") return [];
        const row = entry as { keyword?: unknown; text?: unknown };
        const keyword = typeof row.keyword === "string" ? row.keyword : "";
        const text = typeof row.text === "string" ? row.text : "";
        const line = `${keyword} ${text}`.trim();
        return line ? [{ stepTextSnapshot: line, expectedSnapshot: null }] : [];
      });
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
    return steps.flatMap((entry): StepSnapshot[] =>
      typeof entry === "string" && entry.trim()
        ? [{ stepTextSnapshot: entry, expectedSnapshot: null }]
        : [],
    );
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
        executedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
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
        executedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
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
    const stateArtifacts = await prisma.testRunArtifact.findMany({
      where: { runId, runItemId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        metadata: true,
      },
    });

    const attemptFromState = new Map<number, { id: string; status: TestResultStatus; createdAt: Date }>();
    for (const artifact of stateArtifacts) {
      if (!artifact.metadata || typeof artifact.metadata !== "object") continue;
      const raw = artifact.metadata as Record<string, unknown>;
      if (raw.kind !== "execution_state") continue;
      const attemptNumber = Number(raw.attemptNumber);
      if (!Number.isInteger(attemptNumber) || attemptNumber <= 0) continue;
      const status = parseResultStatus(typeof raw.status === "string" ? raw.status : null) ?? "not_run";
      attemptFromState.set(attemptNumber, {
        id: artifact.id,
        status,
        createdAt: artifact.createdAt,
      });
    }

    const hasLegacyExecution =
      runItem.status !== "not_run"
      || Boolean(runItem.executedAt)
      || runItem.durationMs !== null;
    const totalAttempts = Math.max(
      hasLegacyExecution ? 1 : 0,
      attemptFromState.size > 0 ? Math.max(...attemptFromState.keys()) : 0,
    );

    executions = [];
    for (let attempt = totalAttempts; attempt >= 1; attempt -= 1) {
      const fromState = attemptFromState.get(attempt);
      if (fromState) {
        executions.push({
          id: `legacy-${runItem.id}-${attempt}`,
          attemptNumber: attempt,
          status: fromState.status,
          startedAt: fromState.createdAt,
          completedAt: fromState.status === "not_run" || fromState.status === "in_progress"
            ? null
            : fromState.createdAt,
          durationMs: attempt === 1 ? (runItem.durationMs ?? null) : null,
          executedById: attempt === 1 ? (runItem.executedById ?? null) : null,
          summary: null,
          errorMessage: attempt === 1 ? (runItem.errorMessage ?? null) : null,
          createdAt: fromState.createdAt,
          updatedAt: fromState.createdAt,
          executedBy: attempt === 1 ? (runItem.executedBy ?? null) : null,
          _count: { stepResults: 0, artifacts: 0 },
        });
        continue;
      }

      if (attempt === 1 && hasLegacyExecution) {
        executions.push({
          id: `legacy-${runItem.id}-1`,
          attemptNumber: 1,
          status: runItem.status,
          startedAt: runItem.executedAt ? new Date(runItem.executedAt) : null,
          completedAt: runItem.executedAt ? new Date(runItem.executedAt) : null,
          durationMs: runItem.durationMs ?? null,
          executedById: runItem.executedById ?? null,
          summary: null,
          errorMessage: runItem.errorMessage ?? null,
          createdAt: runItem.createdAt,
          updatedAt: runItem.createdAt,
          executedBy: runItem.executedBy ?? null,
          _count: { stepResults: 0, artifacts: 0 },
        });
      }
    }
  }

  const legacyCurrentExecutionId =
    executions[0]?.id?.startsWith("legacy-") ? executions[0].id : null;

  return NextResponse.json({
    currentExecutionId: runItem.currentExecutionId ?? legacyCurrentExecutionId,
    items: executions,
  });
});

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id: runId, runItemId } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, runId, PERMISSIONS.TEST_RUN_ITEM_UPDATE, activeOrganizationId, organizationRole);
  if (access.error) return access.error;
  const mutableError = await ensureRunMutable(runId);
  if (mutableError) return mutableError;

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
  try {
    const result = await prisma.$transaction(async (tx) => {
      const execution = await tx.testRunItemExecution.create({
        data: {
          runItem: { connect: { id: runItemId } },
          attemptNumber: nextAttemptNumber,
          status: requestedStatus,
          startedAt: now,
          completedAt,
          ...(userId ? { executedBy: { connect: { id: userId } } } : {}),
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
          currentExecution: { connect: { id: execution.id } },
          status: requestedStatus,
          executedAt: completedAt,
          ...(userId ? { executedBy: { connect: { id: userId } } } : {}),
          errorMessage: null,
        },
      });

      await upsertRunMetrics(tx, runId);

      return execution;
    });

    return NextResponse.json({ id: result.id, attemptNumber: nextAttemptNumber }, { status: 201 });
  } catch (error) {
    if (!isLegacyExecutionSchemaError(error)) {
      throw error;
    }

    // Legacy schema fallback: no execution-attempt tables yet.
    const legacyHasExecution =
      runItem.status !== "not_run"
      || Boolean(runItem.executedAt)
      || runItem.durationMs !== null;
    const stateArtifacts = await prisma.testRunArtifact.findMany({
      where: { runId, runItemId },
      select: {
        metadata: true,
      },
    });
    let maxAttemptFromState = 0;
    for (const artifact of stateArtifacts) {
      if (!artifact.metadata || typeof artifact.metadata !== "object") continue;
      const raw = artifact.metadata as Record<string, unknown>;
      if (raw.kind !== "execution_state") continue;
      const attemptNumber = Number(raw.attemptNumber);
      if (!Number.isInteger(attemptNumber) || attemptNumber <= 0) continue;
      if (attemptNumber > maxAttemptFromState) maxAttemptFromState = attemptNumber;
    }
    const baseAttempt = legacyHasExecution ? 1 : 0;
    const legacyAttemptNumber = Math.max(baseAttempt, maxAttemptFromState) + 1;
    const preserveLegacySnapshot = requestedStatus === "not_run" && legacyHasExecution;

    await prisma.$transaction(async (tx) => {
      const legacyExecutedById = preserveLegacySnapshot
        ? runItem.executedById
        : (requestedStatus === "not_run" ? null : userId);

      await tx.testRunItem.update({
        where: { id: runItemId },
        data: {
          status: preserveLegacySnapshot ? runItem.status : requestedStatus,
          executedAt: preserveLegacySnapshot ? runItem.executedAt : completedAt,
          ...(legacyExecutedById
            ? { executedBy: { connect: { id: legacyExecutedById } } }
            : { executedBy: { disconnect: true } }),
          durationMs: preserveLegacySnapshot
            ? runItem.durationMs
            : (requestedStatus === "not_run" ? null : runItem.durationMs),
          errorMessage: preserveLegacySnapshot ? runItem.errorMessage : null,
        },
        select: {
          id: true,
        },
      });

      await tx.testRunArtifact.createMany({
        data: [{
          runId,
          runItemId,
          type: "other",
          name: `Execution #${legacyAttemptNumber} state`,
          url: `legacy://execution-state/${runId}/${runItemId}/${Date.now()}`,
          metadata: {
            kind: "execution_state",
            attemptNumber: legacyAttemptNumber,
            status: requestedStatus,
            source: "legacy_fallback",
            createdAt: now.toISOString(),
          },
        }],
      });

      await upsertRunMetrics(tx, runId);
    });

    return NextResponse.json(
      { id: `legacy-${runItemId}-${legacyAttemptNumber}`, attemptNumber: legacyAttemptNumber },
      { status: 201 },
    );
  }
});
