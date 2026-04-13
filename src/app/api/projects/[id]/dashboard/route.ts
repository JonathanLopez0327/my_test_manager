import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";
import { getManagerDashboardData } from "@/server/manager-dashboard";

export const GET = withAuth(null, async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;

  if (activeOrganizationId) {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!project) {
      return NextResponse.json(
        { message: "Project not found." },
        { status: 404 },
      );
    }
    if (project.organizationId !== activeOrganizationId) {
      return NextResponse.json(
        { message: "The project does not belong to the active organization." },
        { status: 403 },
      );
    }
  }

  await requirePerm(PERMISSIONS.PROJECT_LIST, {
    userId,
    globalRoles,
    organizationId: activeOrganizationId,
    organizationRole,
    projectId: id,
  });

  try {
    const data = await getManagerDashboardData(activeOrganizationId, {
      projectId: id,
    });

    // Aggregate status distribution across ALL runs for this project
    const STATUSES = ["passed", "failed", "blocked", "skipped", "not_run"] as const;
    const STATUS_COLORS: Record<string, string> = {
      passed: "#059669",
      failed: "#DC2626",
      blocked: "#D97706",
      skipped: "#94A3B8",
      not_run: "#D1D5DB",
    };
    const STATUS_LABELS: Record<string, string> = {
      passed: "Passed",
      failed: "Failed",
      blocked: "Blocked",
      skipped: "Skipped",
      not_run: "Not Run",
    };

    const statusGrouped = await prisma.testRunItem.groupBy({
      by: ["status"],
      where: {
        run: { projectId: id, runType: "manual" },
        status: { in: [...STATUSES] },
      },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {
      passed: 0, failed: 0, blocked: 0, skipped: 0, not_run: 0,
    };
    for (const row of statusGrouped) {
      counts[row.status] = row._count._all;
    }

    const total = STATUSES.reduce((sum, s) => sum + counts[s], 0);
    const executed = total - counts.not_run;
    const passRate = executed > 0 ? Math.round((counts.passed / executed) * 100) : 0;

    const allRunsDistribution = {
      data: STATUSES.map((s) => ({
        name: STATUS_LABELS[s],
        value: counts[s],
        color: STATUS_COLORS[s],
        percentage: total > 0 ? Math.round((counts[s] / total) * 100) : 0,
      })),
      total,
      passRate,
    };

    return NextResponse.json({ ...data, allRunsDistribution });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "Could not retrieve project dashboard data." },
      { status: 500 },
    );
  }
});
