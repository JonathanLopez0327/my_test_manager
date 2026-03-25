"use client";

import { useCallback, useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/Card";
import type { ManagerDashboardData } from "@/server/manager-dashboard";

const VISIBLE_KPI_IDS = new Set([
  "quality-status",
  "ready-test-cases",
  "open-defects",
  "latest-manual-run",
]);

const toneClassMap: Record<string, string> = {
  success: "text-success-500",
  danger: "text-danger-500",
  warning: "text-warning-500",
  neutral: "text-ink",
};

type StatusSlice = {
  name: string;
  value: number;
  color: string;
  percentage: number;
};

type AllRunsDistribution = {
  data: StatusSlice[];
  total: number;
  passRate: number;
};

type DashboardResponse = ManagerDashboardData & {
  allRunsDistribution: AllRunsDistribution;
};

type ProjectOverviewTabProps = {
  projectId: string;
};

export function ProjectOverviewTab({ projectId }: ProjectOverviewTabProps) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/dashboard`);
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const json = (await res.json()) as DashboardResponse;
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

  const kpis = data.header.filter((item) => VISIBLE_KPI_IDS.has(item.id));
  const dist = data.allRunsDistribution;

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-stroke bg-surface-muted/50 px-3 py-2.5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
                {item.label}
              </p>
              <p className={`mt-2 text-lg font-semibold ${toneClassMap[item.tone] ?? "text-ink"}`}>
                {item.value}
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">{item.microcopy}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Run Distribution</p>
            <p className="mt-1 text-xs text-ink-muted">All executions across all runs</p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            {dist.total.toLocaleString("en-US")} cases
          </span>
        </div>

        <div className="mt-4 flex items-center gap-8">
          <div className="relative h-[200px] w-[200px] shrink-0">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie
                  data={dist.data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={1.5}
                  strokeWidth={0}
                >
                  {dist.data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-elevated)",
                    border: "1px solid var(--stroke)",
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: "var(--shadow-soft-sm)",
                    color: "var(--ink)",
                  }}
                  itemStyle={{ color: "var(--ink)" }}
                  labelStyle={{ color: "var(--ink-muted)", fontWeight: 600 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: number, name: string) => [
                    `${value.toLocaleString("en-US")} cases`,
                    name,
                  ]) as any}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[28px] font-semibold leading-none text-ink">{dist.passRate}%</p>
              <p className="text-[11px] text-ink-soft">Pass rate</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {dist.data.filter((s) => s.value > 0).map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-xs text-ink-muted">
                  {entry.name} <span className="font-semibold text-ink">{entry.value}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
