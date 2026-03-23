"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { DashboardFilters, DateRangePreset } from "@/server/manager-dashboard/filters";
import type { ProjectsResponse } from "../projects/types";
import type { TestPlansResponse } from "../test-plans/types";
import type { TestSuitesResponse } from "../test-suites/types";

type ProjectOption = { id: string; key: string; name: string };
type PlanOption = { id: string; name: string; projectId: string };
type SuiteOption = { id: string; name: string; testPlanId: string; projectId: string };

const RANGE_OPTIONS: { value: DateRangePreset | ""; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "last5runs", label: "Last 5 runs" },
  { value: "last10runs", label: "Last 10 runs" },
  { value: "custom", label: "Custom range" },
];

const selectClass =
  "h-9 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors";

const dateInputClass =
  "h-9 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors";

type Props = {
  filters: DashboardFilters;
};

export function DashboardFilterBar({ filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [suites, setSuites] = useState<SuiteOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch filter options on mount
  const fetchOptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "100", query: "" });
      const [projectsRes, plansRes, suitesRes] = await Promise.all([
        fetch(`/api/projects?${params.toString()}`),
        fetch(`/api/test-plans?${params.toString()}`),
        fetch(`/api/test-suites?${params.toString()}`),
      ]);

      const [projectsData, plansData, suitesData] = await Promise.all([
        projectsRes.json() as Promise<ProjectsResponse>,
        plansRes.json() as Promise<TestPlansResponse>,
        suitesRes.json() as Promise<TestSuitesResponse>,
      ]);

      if (projectsRes.ok) {
        setProjects(projectsData.items.map((p) => ({ id: p.id, key: p.key, name: p.name })));
      }
      if (plansRes.ok) {
        setPlans(
          plansData.items.map((p) => ({
            id: p.id,
            name: p.name,
            projectId: p.projectId,
          })),
        );
      }
      if (suitesRes.ok) {
        setSuites(
          suitesData.items.map((s) => ({
            id: s.id,
            name: s.name,
            testPlanId: s.testPlan.id,
            projectId: s.testPlan.project.id,
          })),
        );
      }
    } catch {
      // Silently fail — dropdowns will be empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  // Cascading filtered options
  const filteredPlans = useMemo(() => {
    if (!filters.projectId) return plans;
    return plans.filter((p) => p.projectId === filters.projectId);
  }, [plans, filters.projectId]);

  const filteredSuites = useMemo(() => {
    let result = suites;
    if (filters.projectId) {
      result = result.filter((s) => s.projectId === filters.projectId);
    }
    if (filters.testPlanId) {
      result = result.filter((s) => s.testPlanId === filters.testPlanId);
    }
    return result;
  }, [suites, filters.projectId, filters.testPlanId]);

  // URL update helper
  const updateFilters = useCallback(
    (updates: Partial<DashboardFilters>) => {
      const next: DashboardFilters = { ...filters, ...updates };

      // Cascading resets
      if ("projectId" in updates) {
        // If project changed, check if plan is still valid
        const validPlanIds = new Set(
          plans
            .filter((p) => !next.projectId || p.projectId === next.projectId)
            .map((p) => p.id),
        );
        if (next.testPlanId && !validPlanIds.has(next.testPlanId)) {
          next.testPlanId = undefined;
        }
      }
      if ("projectId" in updates || "testPlanId" in updates) {
        // If project or plan changed, check if suite is still valid
        const validSuiteIds = new Set(
          suites
            .filter(
              (s) =>
                (!next.projectId || s.projectId === next.projectId) &&
                (!next.testPlanId || s.testPlanId === next.testPlanId),
            )
            .map((s) => s.id),
        );
        if (next.suiteId && !validSuiteIds.has(next.suiteId)) {
          next.suiteId = undefined;
        }
      }

      // Clear custom date fields if range is not custom
      if (next.range !== "custom") {
        next.startDate = undefined;
        next.endDate = undefined;
      }

      const params = new URLSearchParams();
      if (next.projectId) params.set("projectId", next.projectId);
      if (next.testPlanId) params.set("testPlanId", next.testPlanId);
      if (next.suiteId) params.set("suiteId", next.suiteId);
      if (next.range && next.range !== "7d") params.set("range", next.range);
      if (next.range === "custom") {
        if (next.startDate) params.set("startDate", next.startDate);
        if (next.endDate) params.set("endDate", next.endDate);
      }

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [filters, plans, suites, pathname, router],
  );

  const clearFilters = useCallback(() => {
    router.replace(pathname);
  }, [pathname, router]);

  const hasActiveFilters =
    !!filters.projectId ||
    !!filters.testPlanId ||
    !!filters.suiteId ||
    (!!filters.range && filters.range !== "7d") ||
    !!filters.startDate ||
    !!filters.endDate;

  const currentRange = filters.range ?? "7d";

  return (
    <div className="sticky top-0 z-10 -mx-1 mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-stroke bg-surface-elevated/95 px-4 py-3 shadow-soft backdrop-blur-sm">
      <span className="mr-1 text-xs font-semibold uppercase tracking-widest text-ink-soft">
        Filters
      </span>

      {/* Project */}
      <select
        value={filters.projectId ?? ""}
        onChange={(e) => updateFilters({ projectId: e.target.value || undefined })}
        className={selectClass}
        disabled={loading}
      >
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.key} — {p.name}
          </option>
        ))}
      </select>

      {/* Test Plan */}
      <select
        value={filters.testPlanId ?? ""}
        onChange={(e) => updateFilters({ testPlanId: e.target.value || undefined })}
        className={selectClass}
        disabled={loading}
      >
        <option value="">All test plans</option>
        {filteredPlans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {/* Suite */}
      <select
        value={filters.suiteId ?? ""}
        onChange={(e) => updateFilters({ suiteId: e.target.value || undefined })}
        className={selectClass}
        disabled={loading}
      >
        <option value="">All suites</option>
        {filteredSuites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {/* Date Range */}
      <select
        value={currentRange}
        onChange={(e) =>
          updateFilters({ range: (e.target.value as DateRangePreset) || undefined })
        }
        className={selectClass}
      >
        {RANGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Custom date inputs */}
      {currentRange === "custom" && (
        <>
          <input
            type="date"
            value={filters.startDate ?? ""}
            onChange={(e) => updateFilters({ startDate: e.target.value || undefined })}
            className={dateInputClass}
            placeholder="Start date"
          />
          <span className="text-xs text-ink-muted">to</span>
          <input
            type="date"
            value={filters.endDate ?? ""}
            onChange={(e) => updateFilters({ endDate: e.target.value || undefined })}
            className={dateInputClass}
            placeholder="End date"
          />
        </>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="ml-auto h-9 rounded-lg border border-stroke bg-surface-muted px-3 text-xs font-medium text-ink-muted transition-colors hover:bg-danger-500/10 hover:text-danger-500 hover:border-danger-500/30"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
