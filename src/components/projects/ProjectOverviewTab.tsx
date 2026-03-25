"use client";

import { useCallback, useEffect, useState } from "react";
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

  return (
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
  );
}
