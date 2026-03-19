import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { parseResultStatus, upsertRunMetrics } from "@/lib/test-runs";

export const GET = withAuth(null, async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id: runId, runItemId, executionId } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, runId, PERMISSIONS.TEST_RUN_ITEM_LIST, activeOrganizationId, organizationRole);
  if (access.error) return access.error;

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
    isCurrent: execution.runItem.currentExecutionId === execution.id,
  });
});

export const PATCH = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id: runId, runItemId, executionId } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, runId, PERMISSIONS.TEST_RUN_ITEM_UPDATE, activeOrganizationId, organizationRole);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => ({}))) as {
    status?: string | null;
    summary?: string | null;
    stepResults?: Array<{
      stepIndex: number;
      status?: string | null;
      actualResult?: string | null;
      comment?: string | null;
    }>;
  };

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
        executedAt: completedAt,
        executedById: userId,
        errorMessage: null,
      },
    });

    await upsertRunMetrics(tx, runId);

    return execution;
  });

  return NextResponse.json(updated);
});
