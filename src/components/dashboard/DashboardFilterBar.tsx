"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconCalendar, IconFilter } from "@/components/icons";
import type { DashboardFilters, DateRangePreset } from "@/server/manager-dashboard/filters";
import type { ProjectsResponse } from "../projects/types";
import type { TestPlansResponse } from "../test-plans/types";
import type { TestSuitesResponse } from "../test-suites/types";

type ProjectOption = { id: string; key: string; name: string };
type PlanOption = { id: string; name: string; projectId: string };
type SuiteOption = { id: string; name: string; testPlanId: string; projectId: string };

const RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "last5runs", label: "Last 5 runs" },
  { value: "last10runs", label: "Last 10 runs" },
  { value: "custom", label: "Custom range" },
];

const selectClass =
  "h-9 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors";

const dateInputClass =
  "h-9 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors";

const DEFAULT_FILTERS: DashboardFilters = { range: "7d" };

function getDateRangeLabel(filters: DashboardFilters): string {
  const range = filters.range ?? "7d";
  const preset = RANGE_OPTIONS.find((o) => o.value === range);
  if (range === "custom" && filters.startDate) {
    const fmt = (d: string) => {
      const date = new Date(d + "T00:00:00");
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };
    if (filters.startDate && filters.endDate) {
      return `${fmt(filters.startDate)} – ${fmt(filters.endDate)}`;
    }
    if (filters.startDate) return `From ${fmt(filters.startDate)}`;
    return "Custom range";
  }
  return preset?.label ?? "Last 7 days";
}

type Props = {
  filters: DashboardFilters;
};

export function DashboardFilterBar({ filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DashboardFilters>(filters);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [suites, setSuites] = useState<SuiteOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync draft when filters change externally (back/forward nav)
  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setDraft(filters); // discard draft
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, filters]);

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

  // Cascading filtered options (based on draft)
  const filteredPlans = useMemo(() => {
    if (!draft.projectId) return plans;
    return plans.filter((p) => p.projectId === draft.projectId);
  }, [plans, draft.projectId]);

  const filteredSuites = useMemo(() => {
    let result = suites;
    if (draft.projectId) {
      result = result.filter((s) => s.projectId === draft.projectId);
    }
    if (draft.testPlanId) {
      result = result.filter((s) => s.testPlanId === draft.testPlanId);
    }
    return result;
  }, [suites, draft.projectId, draft.testPlanId]);

  // Update draft with cascading resets
  const updateDraft = useCallback(
    (updates: Partial<DashboardFilters>) => {
      setDraft((prev) => {
        const next = { ...prev, ...updates };

        if ("projectId" in updates) {
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

        if (next.range !== "custom") {
          next.startDate = undefined;
          next.endDate = undefined;
        }

        return next;
      });
    },
    [plans, suites],
  );

  // Apply: commit draft to URL
  const applyFilters = useCallback(() => {
    const next = draft;
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
    setOpen(false);
  }, [draft, pathname, router]);

  // Clear: reset draft inside panel
  const clearDraft = useCallback(() => {
    setDraft({ ...DEFAULT_FILTERS });
  }, []);

  // Active filter count (for badge)
  const activeCount = [
    filters.projectId,
    filters.testPlanId,
    filters.suiteId,
    filters.range && filters.range !== "7d" ? filters.range : undefined,
  ].filter(Boolean).length;

  const dateLabel = getDateRangeLabel(filters);
  const draftRange = draft.range ?? "7d";

  return (
    <div className="relative mb-5 flex items-center gap-3">
      {/* Filter trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
          open
            ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10"
            : "border-stroke bg-surface-elevated text-ink-muted hover:bg-surface-muted dark:bg-surface-muted"
        }`}
      >
        <IconFilter className="h-4 w-4" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold leading-none text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* Date range pill */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-stroke bg-surface-muted px-3.5 text-sm text-ink transition-colors hover:border-brand-500/40 dark:bg-surface-elevated"
      >
        <IconCalendar className="h-4 w-4 text-ink-soft" />
        <span>{dateLabel}</span>
      </button>

      {/* Popover panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full z-20 mt-2 w-80 rounded-xl border border-stroke bg-surface-elevated shadow-soft dark:bg-surface-muted"
          style={{ animationDuration: "150ms" }}
        >
          {/* Header */}
          <div className="border-b border-stroke px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Filters
            </span>
          </div>

          {/* Filter rows */}
          <div className="space-y-3 px-4 py-4">
            {/* Project */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted">Project</label>
              <select
                value={draft.projectId ?? ""}
                onChange={(e) => updateDraft({ projectId: e.target.value || undefined })}
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
            </div>

            {/* Test Plan */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted">Test Plan</label>
              <select
                value={draft.testPlanId ?? ""}
                onChange={(e) => updateDraft({ testPlanId: e.target.value || undefined })}
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
            </div>

            {/* Suite */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted">Suite</label>
              <select
                value={draft.suiteId ?? ""}
                onChange={(e) => updateDraft({ suiteId: e.target.value || undefined })}
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
            </div>

            {/* Date Range */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted">Date Range</label>
              <select
                value={draftRange}
                onChange={(e) =>
                  updateDraft({ range: (e.target.value as DateRangePreset) || undefined })
                }
                className={selectClass}
              >
                {RANGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom date inputs */}
            {draftRange === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-ink-muted">Start</label>
                  <input
                    type="date"
                    value={draft.startDate ?? ""}
                    onChange={(e) => updateDraft({ startDate: e.target.value || undefined })}
                    className={dateInputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-ink-muted">End</label>
                  <input
                    type="date"
                    value={draft.endDate ?? ""}
                    onChange={(e) => updateDraft({ endDate: e.target.value || undefined })}
                    className={dateInputClass}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-stroke px-4 py-3">
            <button
              type="button"
              onClick={clearDraft}
              className="text-sm font-medium text-danger-500 transition-colors hover:text-danger-600"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
