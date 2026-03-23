import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { CompactKpiHeader } from "@/components/dashboard/CompactKpiHeader";
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilterBar";
import { NeedsAttentionCard } from "@/components/dashboard/NeedsAttentionCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { RecentBugsCard } from "@/components/dashboard/RecentBugsCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { TestStatusChart } from "@/components/dashboard/TestStatusChart";
import { TopProblemAreasCard } from "@/components/dashboard/TopProblemAreasCard";
import { TrendChart } from "@/components/dashboard/TrendChart";
import {
  IconAlert,
  IconBug,
  IconChart,
  IconClipboard,
  IconPlay,
} from "@/components/icons";
import { authOptions } from "@/lib/auth";
import { canSync } from "@/lib/auth/can-sync";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import type { GlobalRole, OrgRole } from "@/generated/prisma/client";
import { getManagerDashboardData, parseDashboardFilters } from "@/server/manager-dashboard";

function toneByPassRate(passRate: number): "success" | "warning" | "danger" {
  if (passRate >= 90) return "success";
  if (passRate >= 75) return "warning";
  return "danger";
}

export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);

  const globalRoles = (session?.user?.globalRoles ?? []) as GlobalRole[];
  const organizationRole = session?.user?.organizationRole as OrgRole | undefined;
  if (!canSync(PERMISSIONS.PROJECT_LIST, globalRoles, organizationRole)) {
    redirect("/manager/organizations");
  }

  const activeOrganizationId = session?.user?.activeOrganizationId as string | undefined;
  const filters = parseDashboardFilters(await searchParams);
  const dashboardData = await getManagerDashboardData(activeOrganizationId, filters);

  return (
    <>
      {!activeOrganizationId ? (
        <section className="mb-4 rounded-2xl border border-warning-500/25 bg-warning-500/10 px-5 py-4 text-warning-500">
          <p className="text-sm font-semibold">There is no active organization.</p>
          <p className="mt-1 text-sm">
            Select an organization to view manual run quality metrics.
          </p>
        </section>
      ) : null}

      <DashboardFilterBar filters={filters} />

      <section className="space-y-4">
        <CompactKpiHeader items={dashboardData.header} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            compact
            label="Latest Run Health"
            value={`${dashboardData.latestRunHealth.passRate}%`}
            supportText={
              dashboardData.latestRunHealth.totalExecuted > 0
                ? `${dashboardData.latestRunHealth.totalExecuted} executed · ${dashboardData.latestRunHealth.failed} failed`
                : "Latest run not executed yet"
            }
            microInsight={
              dashboardData.latestRunHealth.totalExecuted === 0
                ? "No completed results"
                : dashboardData.latestRunHealth.deltaVsPreviousRun === null
                  ? "No previous manual run"
                  : `${dashboardData.latestRunHealth.deltaVsPreviousRun > 0 ? "+" : ""}${dashboardData.latestRunHealth.deltaVsPreviousRun}% vs previous run`
            }
            statusBadge={{
              tone:
                dashboardData.latestRunHealth.totalExecuted === 0
                  ? "neutral"
                  : toneByPassRate(dashboardData.latestRunHealth.passRate),
              label:
                dashboardData.latestRunHealth.totalExecuted === 0
                  ? "Awaiting"
                  : dashboardData.latestRunHealth.passRate >= 90
                  ? "Healthy"
                  : dashboardData.latestRunHealth.passRate >= 75
                    ? "Watch"
                    : "Risk",
            }}
            icon={<IconChart className="h-4 w-4 text-brand-700" />}
            accentClassName="bg-brand-50 text-brand-700"
          />
          <StatCard
            compact
            label="Defect Risk"
            value={dashboardData.defectRisk.openBugs.toLocaleString("en-US")}
            supportText={`${dashboardData.defectRisk.openCriticalHigh.toLocaleString("en-US")} critical/high open`}
            microInsight={`${dashboardData.defectRisk.linkedToLatestRun.toLocaleString("en-US")} linked to latest run`}
            statusBadge={{
              tone: dashboardData.defectRisk.openCriticalHigh > 0 ? "danger" : "success",
              label: dashboardData.defectRisk.openCriticalHigh > 0 ? "Attention" : "Controlled",
            }}
            icon={<IconBug className="h-4 w-4 text-danger-500" />}
            accentClassName="bg-danger-100 text-danger-500"
          />
          <StatCard
            compact
            label="Coverage & Readiness"
            value={`${dashboardData.coverageReadiness.readyRate}%`}
            supportText={`${dashboardData.coverageReadiness.ready.toLocaleString("en-US")} ready / ${dashboardData.coverageReadiness.totalTestCases.toLocaleString("en-US")} total`}
            microInsight={`${dashboardData.coverageReadiness.readyWithoutRecentExecution.toLocaleString("en-US")} ready without execution (7 days)`}
            statusBadge={{
              tone:
                dashboardData.coverageReadiness.readyRate >= 80
                  ? "success"
                  : dashboardData.coverageReadiness.readyRate >= 60
                    ? "warning"
                    : "neutral",
              label: "Readiness",
            }}
            icon={<IconClipboard className="h-4 w-4 text-brand-700" />}
            accentClassName="bg-brand-50 text-brand-700"
          />
          <StatCard
            compact
            label="Execution Activity"
            value={dashboardData.executionActivity.runsThisWeek.toLocaleString("en-US")}
            supportText={`${dashboardData.executionActivity.executedCasesThisWeek.toLocaleString("en-US")} executed cases this week`}
            microInsight={`Last run: ${dashboardData.executionActivity.lastRunDate}`}
            statusBadge={{ tone: "info", label: "This week" }}
            icon={<IconPlay className="h-4 w-4 text-warning-500" />}
            accentClassName="bg-warning-500/10 text-warning-500"
          />
        </div>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <TrendChart
          data={dashboardData.trend.data}
          summary={dashboardData.trend.summary}
          subtitle={dashboardData.trend.subtitle}
        />
        <TestStatusChart
          data={dashboardData.latestRunDistribution.data}
          total={dashboardData.latestRunDistribution.total}
          passRate={dashboardData.latestRunDistribution.passRate}
          runLabel={dashboardData.latestRunDistribution.runLabel}
        />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <NeedsAttentionCard items={dashboardData.needsAttention} />
        <TopProblemAreasCard
          suites={dashboardData.topProblemAreas.suites}
          testCases={dashboardData.topProblemAreas.testCases}
        />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-3">
        <ActivityCard runs={dashboardData.latestRuns} />
        <RecentBugsCard bugs={dashboardData.recentBugs} />
        <RecentActivityCard items={dashboardData.recentActivity} />
      </section>

      <section className="mt-4 rounded-xl border border-stroke bg-surface-elevated/90 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <IconAlert className="h-4 w-4 text-ink-soft" />
          <span>
            {dashboardData.needsAttention.length > 0
              ? `${dashboardData.needsAttention.length} actionable signal(s) detected.`
              : "No actionable signals detected for this window."}
          </span>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold text-ink-soft">
            Last update: {new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </section>
    </>
  );
}
