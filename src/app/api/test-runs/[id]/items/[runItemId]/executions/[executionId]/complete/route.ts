import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { parseResultStatus, upsertRunMetrics } from "@/lib/test-runs";

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id: runId, runItemId, executionId } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, runId, PERMISSIONS.TEST_RUN_ITEM_UPDATE, activeOrganizationId, organizationRole);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => ({}))) as {
    status?: string | null;
  };

  const requestedStatus = parseResultStatus(body.status ?? null);
  if (!requestedStatus) {
    return NextResponse.json({ message: "Valid completion status is required." }, { status: 400 });
  }

  const execution = await prisma.testRunItemExecution.findFirst({
    where: {
      id: executionId,
      runItemId,
      runItem: { runId },
    },
    select: {
      id: true,
      runItemId: true,
      runItem: { select: { currentExecutionId: true } },
    },
  });

  if (!execution) {
    return NextResponse.json({ message: "Execution not found." }, { status: 404 });
  }

  if (execution.runItem.currentExecutionId !== executionId) {
    return NextResponse.json({ message: "Only current execution can be completed." }, { status: 409 });
  }

  const now = new Date();
  const completedAt = requestedStatus === "in_progress" || requestedStatus === "not_run" ? null : now;

  await prisma.$transaction(async (tx) => {
    await tx.testRunItemExecution.update({
      where: { id: executionId },
      data: {
        status: requestedStatus,
        executedById: userId,
        startedAt: now,
        completedAt,
      },
    });

    await tx.testRunItem.update({
      where: { id: runItemId },
      data: {
        status: requestedStatus,
        executedById: userId,
        executedAt: completedAt,
      },
    });

    await upsertRunMetrics(tx, runId);
  });

  return NextResponse.json({ ok: true });
});
