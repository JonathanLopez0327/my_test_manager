"use client";

import { useCallback, useEffect, useState } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { CompactKpiHeader } from "@/components/dashboard/CompactKpiHeader";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { TestStatusChart } from "@/components/dashboard/TestStatusChart";
import { NeedsAttentionCard } from "@/components/dashboard/NeedsAttentionCard";
import { TopProblemAreasCard } from "@/components/dashboard/TopProblemAreasCard";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { RecentBugsCard } from "@/components/dashboard/RecentBugsCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import {
  IconBug,
  IconChart,
  IconClipboard,
  IconPlay,
} from "@/components/icons";
import type { ManagerDashboardData } from "@/server/manager-dashboard";

function toneByPassRate(passRate: number): "success" | "warning" | "danger" {
  if (passRate >= 90) return "success";
  if (passRate >= 75) return "warning";
  return "danger";
}

type ProjectOverviewTabProps = {
  projectId: string;
};

export function ProjectOverviewTab({ projectId }: ProjectOverviewTabProps) {
  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/dashboard`);
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const json = (await res.json()) as ManagerDashboardData;
      // Fix Date fields serialized as strings from JSON
      json.recentBugs = json.recentBugs.map((bug) => ({
        ...bug,
        createdAt: new Date(bug.createdAt),
      }));
      setData(json);
    } catch {
      setError("Could not load project metrics.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard(projectId);
  }, [projectId, fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-ink-muted">Loading metrics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-danger-600">{error ?? "No data available."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <CompactKpiHeader items={data.header} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          compact
          label="Latest Run Health"
          value={`${data.latestRunHealth.passRate}%`}
          supportText={
            data.latestRunHealth.totalExecuted > 0
              ? `${data.latestRunHealth.totalExecuted} executed · ${data.latestRunHealth.failed} failed`
              : "Latest run not executed yet"
          }
          microInsight={
            data.latestRunHealth.totalExecuted === 0
              ? "No completed results"
              : data.latestRunHealth.deltaVsPreviousRun === null
                ? "No previous manual run"
                : `${data.latestRunHealth.deltaVsPreviousRun > 0 ? "+" : ""}${data.latestRunHealth.deltaVsPreviousRun}% vs previous run`
          }
          statusBadge={{
            tone:
              data.latestRunHealth.totalExecuted === 0
                ? "neutral"
                : toneByPassRate(data.latestRunHealth.passRate),
            label:
              data.latestRunHealth.totalExecuted === 0
                ? "Awaiting"
                : data.latestRunHealth.passRate >= 90
                  ? "Healthy"
                  : data.latestRunHealth.passRate >= 75
                    ? "Watch"
                    : "Risk",
          }}
          icon={<IconChart className="h-4 w-4 text-brand-700" />}
          accentClassName="bg-brand-50 text-brand-700"
        />
        <StatCard
          compact
          label="Defect Risk"
          value={data.defectRisk.openBugs.toLocaleString("en-US")}
          supportText={`${data.defectRisk.openCriticalHigh.toLocaleString("en-US")} critical/high open`}
          microInsight={`${data.defectRisk.linkedToLatestRun.toLocaleString("en-US")} linked to latest run`}
          statusBadge={{
            tone: data.defectRisk.openCriticalHigh > 0 ? "danger" : "success",
            label: data.defectRisk.openCriticalHigh > 0 ? "Attention" : "Controlled",
          }}
          icon={<IconBug className="h-4 w-4 text-danger-500" />}
          accentClassName="bg-danger-100 text-danger-500"
        />
        <StatCard
          compact
          label="Coverage & Readiness"
          value={`${data.coverageReadiness.readyRate}%`}
          supportText={`${data.coverageReadiness.ready.toLocaleString("en-US")} ready / ${data.coverageReadiness.totalTestCases.toLocaleString("en-US")} total`}
          microInsight={`${data.coverageReadiness.readyWithoutRecentExecution.toLocaleString("en-US")} ready without execution (7 days)`}
          statusBadge={{
            tone:
              data.coverageReadiness.readyRate >= 80
                ? "success"
                : data.coverageReadiness.readyRate >= 60
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
          value={data.executionActivity.runsThisWeek.toLocaleString("en-US")}
          supportText={`${data.executionActivity.executedCasesThisWeek.toLocaleString("en-US")} executed cases this week`}
          microInsight={`Last run: ${data.executionActivity.lastRunDate}`}
          statusBadge={{ tone: "info", label: "This week" }}
          icon={<IconPlay className="h-4 w-4 text-warning-500" />}
          accentClassName="bg-warning-500/10 text-warning-500"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <TrendChart
          data={data.trend.data}
          summary={data.trend.summary}
          subtitle={data.trend.subtitle}
        />
        <TestStatusChart
          data={data.latestRunDistribution.data}
          total={data.latestRunDistribution.total}
          passRate={data.latestRunDistribution.passRate}
          runLabel={data.latestRunDistribution.runLabel}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <NeedsAttentionCard items={data.needsAttention} />
        <TopProblemAreasCard
          suites={data.topProblemAreas.suites}
          testCases={data.topProblemAreas.testCases}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ActivityCard runs={data.latestRuns} />
        <RecentBugsCard bugs={data.recentBugs} />
        <RecentActivityCard items={data.recentActivity} />
      </div>
    </div>
  );
}
