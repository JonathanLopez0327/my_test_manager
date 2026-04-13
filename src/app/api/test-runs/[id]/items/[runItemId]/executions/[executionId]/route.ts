import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { parseResultStatus, upsertRunMetrics } from "@/lib/test-runs";
import { ensureRunMutable } from "@/lib/auth/ensure-run-mutable";

type LegacyStepSnapshot = {
  stepTextSnapshot: string;
  expectedSnapshot: string | null;
};

function isLegacyExecutionSchemaError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2022";
}

function parseLegacyAttemptNumber(executionId: string, runItemId: string) {
  const prefix = `legacy-${runItemId}-`;
  if (!executionId.startsWith(prefix)) return null;
  const parsed = Number(executionId.slice(prefix.length));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseLegacyStepSnapshots(steps: unknown): LegacyStepSnapshot[] {
  if (!steps) return [];
  if (Array.isArray(steps)) {
    return steps
      .map((entry) => {
        if (typeof entry === "string") {
          return { stepTextSnapshot: entry, expectedSnapshot: null };
        }
        if (!entry || typeof entry !== "object") return null;
        const value = entry as { step?: unknown; expectedResult?: unknown; text?: unknown };
        const text =
          typeof value.step === "string"
            ? value.step
            : (typeof value.text === "string" ? value.text : "");
        return {
          stepTextSnapshot: text,
          expectedSnapshot: typeof value.expectedResult === "string" ? value.expectedResult : null,
        };
      })
      .filter((entry): entry is LegacyStepSnapshot => Boolean(entry?.stepTextSnapshot?.trim()));
  }
  return [];
}

function parseExecutionStateSnapshots(artifacts: Array<{ id: string; metadata: unknown; createdAt?: Date }>) {
  const byAttempt = new Map<number, { id: string; status: ReturnType<typeof parseResultStatus> | "not_run"; createdAt: Date | null }>();
  for (const artifact of artifacts) {
    if (!artifact.metadata || typeof artifact.metadata !== "object") continue;
    const raw = artifact.metadata as Record<string, unknown>;
    if (raw.kind !== "execution_state") continue;
    const attemptNumber = Number(raw.attemptNumber);
    if (!Number.isInteger(attemptNumber) || attemptNumber <= 0) continue;
    const status = parseResultStatus(typeof raw.status === "string" ? raw.status : null) ?? "not_run";
    byAttempt.set(attemptNumber, {
      id: artifact.id,
      status,
      createdAt: artifact.createdAt ?? null,
    });
  }
  return byAttempt;
}

export const GET = withAuth(null, async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id: runId, runItemId, executionId } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, runId, PERMISSIONS.TEST_RUN_ITEM_LIST, activeOrganizationId, organizationRole);
  if (access.error) return access.error;

  try {
    const execution = await prisma.testRunItemExecution.findFirst({
      where: {
        id: executionId,
        runItemId,
        runItem: { runId },
      },
      include: {
        executedBy: {
          select: { id: true, fullName: true, email: true },
        },
        stepResults: {
          orderBy: { stepIndex: "asc" },
        },
        artifacts: {
          orderBy: { createdAt: "desc" },
        },
        runItem: {
          select: {
            currentExecutionId: true,
            testCase: {
              select: {
                id: true,
                title: true,
                externalKey: true,
                style: true,
                steps: true,
              },
            },
          },
        },
      },
    });

    if (!execution) {
      return NextResponse.json({ message: "Execution not found." }, { status: 404 });
    }

    return NextResponse.json({
      ...execution,
      artifacts: execution.artifacts.map((a) => ({
        ...a,
        sizeBytes: a.sizeBytes != null ? Number(a.sizeBytes) : null,
      })),
      isCurrent: execution.runItem.currentExecutionId === execution.id,
    });
  } catch (error) {
    if (!isLegacyExecutionSchemaError(error)) throw error;

    const runItem = await prisma.testRunItem.findFirst({
      where: { id: runItemId, runId },
      select: {
        id: true,
        status: true,
        durationMs: true,
        executedAt: true,
        executedById: true,
        errorMessage: true,
        createdAt: true,
        executedBy: {
          select: { id: true, fullName: true, email: true },
        },
        testCase: {
          select: {
            steps: true,
          },
        },
      },
    });
    if (!runItem) {
      return NextResponse.json({ message: "Run item not found." }, { status: 404 });
    }

    const stateArtifacts = await prisma.testRunArtifact.findMany({
      where: { runId, runItemId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        metadata: true,
        createdAt: true,
      },
    });
    const snapshots = parseExecutionStateSnapshots(stateArtifacts);

    const hasLegacyExecution =
      runItem.status !== "not_run"
      || Boolean(runItem.executedAt)
      || runItem.durationMs !== null;
    const totalAttempts = Math.max(
      hasLegacyExecution ? 1 : 0,
      snapshots.size > 0 ? Math.max(...snapshots.keys()) : 0,
    );
    const requestedAttempt = parseLegacyAttemptNumber(executionId, runItemId);
    if (!requestedAttempt || requestedAttempt > totalAttempts || requestedAttempt <= 0) {
      return NextResponse.json({ message: "Execution not found." }, { status: 404 });
    }

    const fromSnapshot = snapshots.get(requestedAttempt);
    const status =
      fromSnapshot?.status
      ?? (requestedAttempt === 1 && hasLegacyExecution ? runItem.status : "not_run");
    const completedAt =
      requestedAttempt === 1 && runItem.executedAt
        ? runItem.executedAt
        : (fromSnapshot?.createdAt ?? null);

    const stepSnapshots = parseLegacyStepSnapshots(runItem.testCase.steps);
    return NextResponse.json({
      id: executionId,
      attemptNumber: requestedAttempt,
      status,
      startedAt: completedAt,
      completedAt: status === "not_run" || status === "in_progress" ? null : completedAt,
      durationMs: requestedAttempt === 1 ? runItem.durationMs : null,
      summary: null,
      errorMessage: requestedAttempt === 1 ? runItem.errorMessage : null,
      executedBy: requestedAttempt === 1 ? runItem.executedBy : null,
      stepResults: stepSnapshots.map((step, index) => ({
        id: `legacy-step-${runItemId}-${requestedAttempt}-${index}`,
        stepIndex: index,
        stepTextSnapshot: step.stepTextSnapshot,
        expectedSnapshot: step.expectedSnapshot,
        status: "not_run",
        actualResult: null,
        comment: null,
      })),
      artifacts: [],
      runItem: {
        currentExecutionId: totalAttempts > 0 ? `legacy-${runItemId}-${totalAttempts}` : null,
      },
      isCurrent: requestedAttempt === totalAttempts,
    });
  }
});

export const PATCH = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id: runId, runItemId, executionId } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, runId, PERMISSIONS.TEST_RUN_ITEM_UPDATE, activeOrganizationId, organizationRole);
  if (access.error) return access.error;
  const mutableError = await ensureRunMutable(runId);
  if (mutableError) return mutableError;

  const body = (await req.json().catch(() => ({}))) as {
    status?: string | null;
    durationMs?: number | null;
    summary?: string | null;
    stepResults?: Array<{
      stepIndex: number;
      status?: string | null;
      actualResult?: string | null;
      comment?: string | null;
    }>;
  };

  try {
    const existing = await prisma.testRunItemExecution.findFirst({
      where: {
        id: executionId,
        runItemId,
        runItem: { runId },
      },
      include: {
        runItem: {
          select: {
            id: true,
            currentExecutionId: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ message: "Execution not found." }, { status: 404 });
    }

    if (existing.runItem.currentExecutionId !== executionId) {
      return NextResponse.json({ message: "Only current execution can be edited." }, { status: 409 });
    }

    const status = parseResultStatus(body.status ?? null) ?? existing.status;
    const durationMs =
      body.durationMs === undefined || body.durationMs === null
        ? existing.durationMs
        : Number(body.durationMs);
    if (durationMs !== null && (!Number.isFinite(durationMs) || durationMs < 0)) {
      return NextResponse.json({ message: "Invalid duration." }, { status: 400 });
    }
    const now = new Date();
    const completedAt = status === "not_run" || status === "in_progress" ? null : now;

    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(body.stepResults) && body.stepResults.length > 0) {
        for (const step of body.stepResults) {
          if (!Number.isInteger(step.stepIndex) || step.stepIndex < 0) continue;
          await tx.testRunItemExecutionStepResult.updateMany({
            where: {
              executionId,
              stepIndex: Number(step.stepIndex),
            },
            data: {
              status: parseResultStatus(step.status ?? null) ?? undefined,
              actualResult: step.actualResult?.trim() || null,
              comment: step.comment?.trim() || null,
            },
          });
        }
      }

      const execution = await tx.testRunItemExecution.update({
        where: { id: executionId },
        data: {
          status,
          durationMs,
          summary: body.summary?.trim() || null,
          startedAt: existing.startedAt ?? now,
          completedAt,
          executedById: userId,
        },
        include: {
          stepResults: {
            orderBy: { stepIndex: "asc" },
          },
        },
      });

      await tx.testRunItem.update({
        where: { id: runItemId },
        data: {
          status,
          durationMs,
          executedAt: completedAt,
          executedById: userId,
          errorMessage: null,
        },
      });

      await upsertRunMetrics(tx, runId);

      return execution;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (!isLegacyExecutionSchemaError(error)) throw error;

    const requestedAttempt = parseLegacyAttemptNumber(executionId, runItemId);
    if (!requestedAttempt) {
      return NextResponse.json({ message: "Execution not found." }, { status: 404 });
    }

    const runItem = await prisma.testRunItem.findFirst({
      where: { id: runItemId, runId },
      select: {
        id: true,
        status: true,
        durationMs: true,
        executedAt: true,
        executedById: true,
        errorMessage: true,
        createdAt: true,
      },
    });
    if (!runItem) {
      return NextResponse.json({ message: "Run item not found." }, { status: 404 });
    }

    const stateArtifacts = await prisma.testRunArtifact.findMany({
      where: { runId, runItemId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        metadata: true,
      },
    });
    const snapshots = parseExecutionStateSnapshots(stateArtifacts);
    const hasLegacyExecution =
      runItem.status !== "not_run"
      || Boolean(runItem.executedAt)
      || runItem.durationMs !== null;
    const totalAttempts = Math.max(
      hasLegacyExecution ? 1 : 0,
      snapshots.size > 0 ? Math.max(...snapshots.keys()) : 0,
    );
    if (requestedAttempt !== totalAttempts) {
      return NextResponse.json({ message: "Only current execution can be edited." }, { status: 409 });
    }

    const status = parseResultStatus(body.status ?? null) ?? runItem.status;
    const durationMs =
      body.durationMs === undefined || body.durationMs === null
        ? runItem.durationMs
        : Number(body.durationMs);
    if (durationMs !== null && (!Number.isFinite(durationMs) || durationMs < 0)) {
      return NextResponse.json({ message: "Invalid duration." }, { status: 400 });
    }
    const now = new Date();
    const completedAt = status === "not_run" || status === "in_progress" ? null : now;

    await prisma.$transaction(async (tx) => {
      await tx.testRunItem.update({
        where: { id: runItemId },
        data: {
          status,
          durationMs,
          executedAt: completedAt,
          executedById: userId,
          errorMessage: null,
        },
        select: { id: true },
      });

      const existingSnapshot = stateArtifacts.find((artifact) => {
        if (!artifact.metadata || typeof artifact.metadata !== "object") return false;
        const raw = artifact.metadata as Record<string, unknown>;
        return raw.kind === "execution_state" && Number(raw.attemptNumber) === requestedAttempt;
      });

      if (existingSnapshot) {
        await tx.testRunArtifact.update({
          where: { id: existingSnapshot.id },
          data: {
            metadata: {
              kind: "execution_state",
              attemptNumber: requestedAttempt,
              status,
              source: "legacy_fallback",
              updatedAt: now.toISOString(),
            },
          },
          select: { id: true },
        });
      } else {
        await tx.testRunArtifact.create({
          data: {
            runId,
            runItemId,
            type: "other",
            name: `Execution #${requestedAttempt} state`,
            url: `legacy://execution-state/${runId}/${runItemId}/${Date.now()}`,
            metadata: {
              kind: "execution_state",
              attemptNumber: requestedAttempt,
              status,
              source: "legacy_fallback",
              createdAt: now.toISOString(),
            },
          },
          select: { id: true },
        });
      }

      await upsertRunMetrics(tx, runId);
    });

    return NextResponse.json({
      id: executionId,
      attemptNumber: requestedAttempt,
      status,
      startedAt: runItem.executedAt,
      completedAt,
      durationMs,
      summary: body.summary?.trim() || null,
      stepResults: [],
      artifacts: [],
      runItem: {
        currentExecutionId: executionId,
      },
      isCurrent: true,
    });
  }
});
