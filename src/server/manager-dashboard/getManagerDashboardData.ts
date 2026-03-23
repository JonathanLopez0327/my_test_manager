import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildNeedsAttentionSignals } from "./buildNeedsAttentionSignals";
import { buildRecentActivityFeed } from "./buildRecentActivityFeed";
import { buildTopProblemAreas } from "./buildTopProblemAreas";
import type { DashboardFilters } from "./filters";
import { resolveDateRange, resolveRunLimit } from "./filters";
import {
  formatCount,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  statusLabel,
  statusTone,
  toNumber,
} from "./helpers";
import type { ManagerDashboardData, StatusSlice, TrendPoint } from "./types";

const DEFAULT_RUN_LIMIT = 7;
const RECENT_BUGS_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 10;

const ORDERED_STATUSES = ["passed", "failed", "blocked", "skipped", "not_run"] as const;
type OrderedStatus = (typeof ORDERED_STATUSES)[number];

const STATUS_COLORS: Record<OrderedStatus, string> = {
  passed: "#059669",
  failed: "#DC2626",
  blocked: "#D97706",
  skipped: "#94A3B8",
  not_run: "#D1D5DB",
};

const STATUS_LABELS: Record<OrderedStatus, string> = {
  passed: "Passed",
  failed: "Failed",
  blocked: "Blocked",
  skipped: "Skipped",
  not_run: "Not Run",
};

function getWeekStart(now: Date, days = 7): Date {
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - (days - 1));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function buildStatusSlices(countsByStatus: Record<OrderedStatus, number>): {
  slices: StatusSlice[];
  total: number;
  passRate: number;
} {
  const total = ORDERED_STATUSES.reduce((sum, status) => sum + countsByStatus[status], 0);
  const executed = total - countsByStatus.not_run;
  const passRate = executed > 0 ? Math.round((countsByStatus.passed / executed) * 100) : 0;

  const slices = ORDERED_STATUSES.map((status) => {
    const value = countsByStatus[status];
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
    return {
      name: STATUS_LABELS[status],
      value,
      percentage,
      color: STATUS_COLORS[status],
    };
  });

  return { slices, total, passRate };
}

export async function getManagerDashboardData(
  activeOrganizationId?: string,
  filters?: DashboardFilters,
): Promise<ManagerDashboardData> {
  const now = new Date();
  const dateRange = resolveDateRange(filters, now);
  const runLimit = resolveRunLimit(filters);
  const sevenDaysAgo = getWeekStart(now);

  // --- Build Prisma WHERE filters ---
  const orgProject: Prisma.ProjectWhereInput = activeOrganizationId
    ? { organizationId: activeOrganizationId }
    : {};

  const projectFilter: Prisma.TestRunWhereInput = filters?.projectId
    ? { projectId: filters.projectId }
    : {};

  const planFilter: Prisma.TestRunWhereInput = filters?.testPlanId
    ? { testPlanId: filters.testPlanId }
    : {};

  const suiteFilter: Prisma.TestRunWhereInput = filters?.suiteId
    ? { suiteId: filters.suiteId }
    : {};

  const dateFilter: Prisma.TestRunWhereInput = dateRange
    ? { createdAt: dateRange }
    : {};

  const runOrgFilter: Prisma.TestRunWhereInput = {
    ...(activeOrganizationId ? { project: orgProject } : {}),
    ...projectFilter,
    ...planFilter,
    ...suiteFilter,
  };

  const manualRunOrgFilter: Prisma.TestRunWhereInput = {
    ...runOrgFilter,
    runType: "manual",
  };

  const manualRunOrgFilterWithDate: Prisma.TestRunWhereInput = {
    ...manualRunOrgFilter,
    ...dateFilter,
  };

  const manualRunItemOrgFilter: Prisma.TestRunItemWhereInput = {
    run: manualRunOrgFilter,
  };

  const hasTestCaseFilters =
    activeOrganizationId || filters?.projectId || filters?.testPlanId || filters?.suiteId;

  const testCaseOrgFilter: Prisma.TestCaseWhereInput = hasTestCaseFilters
    ? {
        suite: {
          testPlan: {
            project: orgProject,
            ...(filters?.projectId ? { projectId: filters.projectId } : {}),
          },
          ...(filters?.testPlanId ? { testPlanId: filters.testPlanId } : {}),
          ...(filters?.suiteId ? { id: filters.suiteId } : {}),
        },
      }
    : {};

  const bugOrgFilter: Prisma.BugWhereInput = {
    ...(activeOrganizationId || filters?.projectId ? { project: orgProject } : {}),
    ...(filters?.projectId ? { projectId: filters.projectId } : {}),
    ...(dateRange ? { createdAt: dateRange } : {}),
  };

  const runArtifactRunFilter: Prisma.TestRunWhereInput = {
    ...runOrgFilter,
    runType: "manual",
  };

  const artifactOrgFilter: Prisma.TestRunArtifactWhereInput = {
    OR: [
      { run: runArtifactRunFilter },
      { runItem: { run: runArtifactRunFilter } },
    ],
  };

  const [
    latestManualRuns,
    runsThisWeek,
    executedCasesThisWeek,
    openBugs,
    openCriticalHigh,
    totalTestCases,
    readyTestCases,
    draftTestCases,
    deprecatedTestCases,
    readyCasesExecutedRecently,
    recentBugs,
    failedRunItemsForSuites,
    linkedBugsByTestCase,
    recentRunsForActivity,
    recentBugsForActivity,
    recentTestCasesForActivity,
    recentSuitesForActivity,
    recentArtifactsForActivity,
  ] = await prisma.$transaction([
    prisma.testRun.findMany({
      where: manualRunOrgFilterWithDate,
      orderBy: [{ createdAt: "desc" }],
      take: runLimit,
      select: {
        id: true,
        name: true,
        status: true,
        environment: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        suite: { select: { name: true } },
        testPlan: { select: { name: true } },
        metrics: {
          select: {
            total: true,
            passed: true,
            failed: true,
            skipped: true,
            blocked: true,
            notRun: true,
            passRate: true,
            durationMs: true,
          },
        },
      },
    }),
    prisma.testRun.count({
      where: {
        ...manualRunOrgFilter,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.testRunItem.count({
      where: {
        ...manualRunItemOrgFilter,
        executedAt: { gte: sevenDaysAgo },
        status: { not: "not_run" },
      },
    }),
    prisma.bug.count({
      where: {
        ...bugOrgFilter,
        status: { notIn: ["closed", "verified"] },
      },
    }),
    prisma.bug.count({
      where: {
        ...bugOrgFilter,
        status: { notIn: ["closed", "verified"] },
        severity: { in: ["critical", "high"] },
      },
    }),
    prisma.testCase.count({ where: testCaseOrgFilter }),
    prisma.testCase.count({ where: { ...testCaseOrgFilter, status: "ready" } }),
    prisma.testCase.count({ where: { ...testCaseOrgFilter, status: "draft" } }),
    prisma.testCase.count({ where: { ...testCaseOrgFilter, status: "deprecated" } }),
    prisma.testRunItem.findMany({
      where: {
        ...manualRunItemOrgFilter,
        executedAt: { gte: sevenDaysAgo },
        status: { not: "not_run" },
        testCase: { status: "ready" },
      },
      distinct: ["testCaseId"],
      select: { testCaseId: true },
    }),
    prisma.bug.findMany({
      where: bugOrgFilter,
      orderBy: [{ createdAt: "desc" }],
      take: RECENT_BUGS_LIMIT,
      select: {
        id: true,
        title: true,
        severity: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.testRunItem.findMany({
      where: {
        ...manualRunItemOrgFilter,
        status: "failed",
        executedAt: { gte: sevenDaysAgo },
      },
      select: {
        run: {
          select: {
            suite: { select: { name: true } },
          },
        },
      },
      take: 300,
    }),
    prisma.bug.findMany({
      where: {
        ...bugOrgFilter,
        testCaseId: { not: null },
        status: { notIn: ["closed", "verified"] },
      },
      select: {
        testCaseId: true,
        testCase: { select: { title: true } },
      },
      take: 300,
    }),
    prisma.testRun.findMany({
      where: manualRunOrgFilter,
      orderBy: [{ createdAt: "desc" }],
      take: RECENT_ACTIVITY_LIMIT,
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    }),
    prisma.bug.findMany({
      where: bugOrgFilter,
      orderBy: [{ updatedAt: "desc" }],
      take: RECENT_ACTIVITY_LIMIT,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.testCase.findMany({
      where: testCaseOrgFilter,
      orderBy: [{ updatedAt: "desc" }],
      take: RECENT_ACTIVITY_LIMIT,
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
    }),
    prisma.testSuite.findMany({
      where: activeOrganizationId
        ? { testPlan: { project: { organizationId: activeOrganizationId } } }
        : {},
      orderBy: [{ updatedAt: "desc" }],
      take: RECENT_ACTIVITY_LIMIT,
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    }),
    prisma.testRunArtifact.findMany({
      where: artifactOrgFilter,
      orderBy: [{ createdAt: "desc" }],
      take: RECENT_ACTIVITY_LIMIT,
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    }),
  ]);

  const latestRun = latestManualRuns[0] ?? null;
  const previousRun = latestManualRuns[1] ?? null;

  const runIds = latestManualRuns.map((run) => run.id);
  const runStatusGrouped = runIds.length
    ? await prisma.testRunItem.groupBy({
        by: ["runId", "status"],
        where: {
          runId: { in: runIds },
          status: { in: ORDERED_STATUSES },
        },
        _count: { _all: true },
      })
    : [];

  const runStatusMap = new Map<string, Record<OrderedStatus, number>>();
  for (const runId of runIds) {
    runStatusMap.set(runId, {
      passed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      not_run: 0,
    });
  }

  for (const row of runStatusGrouped) {
    const entry = runStatusMap.get(row.runId);
    if (!entry) continue;
    if (!ORDERED_STATUSES.includes(row.status as OrderedStatus)) continue;
    const status = row.status as OrderedStatus;
    entry[status] = row._count._all;
  }

  const getRunCounts = (runId: string): Record<OrderedStatus, number> => {
    return runStatusMap.get(runId) ?? {
      passed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      not_run: 0,
    };
  };

  const latestRunCounts = latestRun
    ? latestRun.metrics
      ? {
          passed: latestRun.metrics.passed,
          failed: latestRun.metrics.failed,
          blocked: latestRun.metrics.blocked,
          skipped: latestRun.metrics.skipped,
          not_run: latestRun.metrics.notRun,
        }
      : getRunCounts(latestRun.id)
    : { passed: 0, failed: 0, blocked: 0, skipped: 0, not_run: 0 };

  const previousRunCounts = previousRun
    ? previousRun.metrics
      ? {
          passed: previousRun.metrics.passed,
          failed: previousRun.metrics.failed,
          blocked: previousRun.metrics.blocked,
          skipped: previousRun.metrics.skipped,
          not_run: previousRun.metrics.notRun,
        }
      : getRunCounts(previousRun.id)
    : null;

  const latestDistribution = buildStatusSlices(latestRunCounts);
  const previousDistribution = previousRunCounts
    ? buildStatusSlices(previousRunCounts)
    : null;
  const latestExecutedCount =
    latestRunCounts.passed +
    latestRunCounts.failed +
    latestRunCounts.blocked +
    latestRunCounts.skipped;

  const deltaVsPreviousRun =
    previousDistribution !== null
      ? latestDistribution.passRate - previousDistribution.passRate
      : null;

  const latestRunName = latestRun
    ? latestRun.name?.trim() || latestRun.testPlan?.name || `Run ${latestRun.id.slice(0, 8)}`
    : "No manual runs";

  const linkedToLatestRun = latestRun
    ? await prisma.bug.count({
        where: {
          ...bugOrgFilter,
          testRunId: latestRun.id,
          status: { notIn: ["closed", "verified"] },
        },
      })
    : 0;

  const topProblemAreas = buildTopProblemAreas({
    failedItems: failedRunItemsForSuites.map((item) => ({
      suiteName: item.run.suite?.name ?? null,
    })),
    bugsLinkedCases: linkedBugsByTestCase
      .filter((item): item is { testCaseId: string; testCase: { title: string } } => {
        return Boolean(item.testCaseId && item.testCase?.title);
      })
      .map((item) => ({
        testCaseId: item.testCaseId as string,
        testCaseTitle: item.testCase.title,
      })),
  });

  const readyWithoutRecentExecution = Math.max(
    0,
    readyTestCases - readyCasesExecutedRecently.length,
  );
  const readyRate = totalTestCases > 0 ? Math.round((readyTestCases / totalTestCases) * 100) : 0;

  const needsAttention = buildNeedsAttentionSignals({
    passRateDeltaVsPreviousRun: deltaVsPreviousRun,
    latestBlockedCases: latestRunCounts.blocked,
    unstableSuites: topProblemAreas.suites,
    openCriticalHighBugs: openCriticalHigh,
    readyWithoutRecentExecution,
  });

  const trendData: TrendPoint[] = latestManualRuns
    .slice()
    .reverse()
    .map((run, index) => {
      const runName = run.name?.trim() || `Run ${run.id.slice(0, 8)}`;
      const counts = run.metrics
        ? {
            passed: run.metrics.passed,
            failed: run.metrics.failed,
            blocked: run.metrics.blocked,
            skipped: run.metrics.skipped,
            not_run: run.metrics.notRun,
          }
        : getRunCounts(run.id);
      const distribution = buildStatusSlices(counts);
      return {
        label: `R${index + 1}`,
        passRate: distribution.passRate,
        runName,
      };
    });

  const averagePassRate =
    trendData.length > 0
      ? Math.round(trendData.reduce((sum, point) => sum + point.passRate, 0) / trendData.length)
      : 0;

  const runSummaryItems = latestManualRuns.map((run) => {
    const title = run.name?.trim() || run.testPlan?.name || `Run ${run.id.slice(0, 8)}`;
    const suite = run.suite?.name || "No suite";
    const metrics = run.metrics;
    const counts = metrics
      ? {
          total: metrics.total,
          passed: metrics.passed,
          failed: metrics.failed,
          passRate: Math.round(toNumber(metrics.passRate)),
          blocked: metrics.blocked,
          skipped: metrics.skipped,
          notRun: metrics.notRun,
        }
      : (() => {
          const raw = getRunCounts(run.id);
          const distribution = buildStatusSlices(raw);
          return {
            total: raw.passed + raw.failed + raw.blocked + raw.skipped + raw.not_run,
            passed: raw.passed,
            failed: raw.failed,
            passRate: distribution.passRate,
            blocked: raw.blocked,
            skipped: raw.skipped,
            notRun: raw.not_run,
          };
        })();

    return {
      id: run.id,
      title,
      suite,
      environment: run.environment || "No environment",
      when: formatRelativeTime(run.startedAt ?? run.createdAt),
      duration: formatDuration(metrics?.durationMs ?? null, run.startedAt, run.finishedAt),
      tests: `${counts.total} tests`,
      outcome: `${counts.passed}/${counts.total} passed · ${counts.failed} failed · ${counts.passRate}%`,
      status: statusLabel(run.status),
      tone: statusTone(run.status),
      failedCount: counts.failed,
    };
  });

  // TODO(v2): Enrich this feed with AuditLog semantic actions once audit writes are standardized.
  const recentActivity = buildRecentActivityFeed({
    runs: recentRunsForActivity,
    bugs: recentBugsForActivity,
    testCases: recentTestCasesForActivity,
    testSuites: recentSuitesForActivity,
    artifacts: recentArtifactsForActivity,
    limit: RECENT_ACTIVITY_LIMIT,
  });

  const header = [
    {
      id: "quality-status",
      label: "Quality Status",
      value: !latestRun
        ? "Awaiting execution"
        : latestExecutedCount === 0
          ? "No completed results"
          : `${latestDistribution.passRate}%`,
      microcopy: !latestRun
        ? "Latest run not executed yet"
        : latestExecutedCount === 0
          ? "Latest run not executed yet"
          : "from latest run",
      tone: !latestRun || latestExecutedCount === 0
        ? "warning"
        : latestDistribution.passRate >= 90
          ? "success"
          : latestDistribution.passRate >= 75
            ? "warning"
            : "danger",
    },
    {
      id: "latest-manual-run",
      label: "Latest Manual Run",
      value: latestRun ? formatDateTime(latestRun.createdAt) : "No runs",
      microcopy: latestRun ? latestRunName : "create your first manual run",
      tone: latestRun ? "neutral" : "warning",
    },
    {
      id: "open-defects",
      label: "Open Defects",
      value: formatCount(openBugs),
      microcopy: `${formatCount(openCriticalHigh)} critical/high`,
      tone: openCriticalHigh > 0 ? "danger" : "neutral",
    },
    {
      id: "ready-test-cases",
      label: "Ready Test Cases",
      value: formatCount(readyTestCases),
      microcopy: `${readyRate}% readiness`,
      tone: readyRate >= 80 ? "success" : readyRate >= 60 ? "warning" : "neutral",
    },
    {
      id: "recent-activity",
      label: "Recent Activity",
      value: formatCount(recentActivity.length),
      microcopy: "latest 10 events",
      tone: recentActivity.length > 0 ? "neutral" : "warning",
    },
  ] as const;

  return {
    header: [...header],
    latestRunHealth: {
      totalExecuted: latestExecutedCount,
      passed: latestRunCounts.passed,
      failed: latestRunCounts.failed,
      blocked: latestRunCounts.blocked,
      skipped: latestRunCounts.skipped,
      notRun: latestRunCounts.not_run,
      passRate: latestDistribution.passRate,
      latestRunName,
      latestRunWhen: latestRun ? formatRelativeTime(latestRun.createdAt) : "No runs",
      deltaVsPreviousRun: deltaVsPreviousRun,
    },
    defectRisk: {
      openBugs,
      openCriticalHigh,
      linkedToLatestRun,
      summary:
        openCriticalHigh > 0
          ? "Critical/high defects are increasing operational risk."
          : "No critical/high open defects detected.",
    },
    coverageReadiness: {
      totalTestCases,
      ready: readyTestCases,
      draft: draftTestCases,
      deprecated: deprecatedTestCases,
      readyRate,
      readyWithoutRecentExecution,
    },
    executionActivity: {
      runsThisWeek,
      executedCasesThisWeek,
      lastRunDate: latestRun ? formatDateTime(latestRun.createdAt) : "No runs",
    },
    trend: {
      data: trendData,
      summary:
        trendData.length > 0
          ? `${trendData.length} manual runs · ${averagePassRate}% average pass rate`
          : "No manual runs in recent history",
      subtitle: "Primary view: pass rate trend by manual run",
    },
    latestRunDistribution: {
      data: latestDistribution.slices,
      total: latestDistribution.total,
      passRate: latestDistribution.passRate,
      runLabel: latestRunName,
    },
    needsAttention,
    topProblemAreas,
    latestRuns: runSummaryItems,
    recentBugs,
    recentActivity,
  };
}
