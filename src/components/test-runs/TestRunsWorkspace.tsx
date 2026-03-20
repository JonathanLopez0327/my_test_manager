"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { IconCheck, IconChevronDown, IconChevronRight, IconDownload, IconEdit, IconFolder, IconMenu, IconPlus } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { TableShell } from "@/components/ui/TableShell";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { TestRunFormSheet } from "./TestRunFormSheet";
import {
  TestRunExecutionModal,
  type ExecutionDetailRecord,
  type ExecutionHistoryItemRecord,
  type ExecutionHistoryResponse,
  type ExecutionItemRecord,
  type ExecutionStatus,
} from "./TestRunExecutionModal";
import type { TestRunMetricsRecord, TestRunPayload, TestRunRecord, TestRunsResponse } from "./types";
import type { ProjectsResponse } from "@/components/projects/types";
import type { TestPlansResponse } from "@/components/test-plans/types";
import type { TestSuitesResponse } from "@/components/test-suites/types";
import { cn } from "@/lib/utils";

const LIST_PAGE_SIZE = 50;
const ITEM_PAGE_SIZE = 100;
const ARTIFACT_PAGE_SIZE = 100;

type WorkspaceTab = "test-cases" | "metrics" | "artifacts";

type RunItemStatus = "passed" | "failed" | "skipped" | "blocked" | "not_run";

type RunItemRecord = {
  id: string;
  status: RunItemStatus;
  currentExecutionId?: string | null;
  latestAttemptNumber?: number | null;
  attemptCount?: number;
  currentExecution?: {
    id: string;
    attemptNumber: number;
  } | null;
  _count?: {
    executions?: number;
  };
  durationMs: number | null;
  executedAt: string | null;
  errorMessage: string | null;
  testCase: {
    id: string;
    title: string;
    externalKey: string | null;
    preconditions: string | null;
    steps: unknown;
    style: "step_by_step" | "gherkin" | "data_driven" | "api";
  };
  executedBy: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
};

type RunArtifactRecord = {
  id: string;
  runItemId: string | null;
  executionId?: string | null;
  type: string | null;
  name: string | null;
  url: string;
  mimeType: string | null;
  createdAt: string;
  sizeBytes?: number | string | bigint | null;
  metadata?: unknown;
};

type ArtifactExecutionGroupRecord = {
  runId: string | null;
  runLabel: string;
  runNumber: number | null;
  status: string | null;
  executedAt: string | null;
  artifacts: RunArtifactRecord[];
};

type ArtifactByTestGroupRecord = {
  testId: string;
  testName: string;
  totalArtifacts: number;
  lastArtifactAt: string;
  executions: ArtifactExecutionGroupRecord[];
};

type RunItemEditState = {
  status: RunItemStatus;
};

type ProjectOption = {
  id: string;
  key: string;
  name: string;
};

type TestPlanOption = {
  id: string;
  name: string;
  projectId: string;
  projectKey: string;
};

type TestSuiteOption = {
  id: string;
  name: string;
  testPlanId: string;
  testPlanName: string;
  projectId: string;
  projectKey: string;
};

const runStatusLabel: Record<TestRunRecord["status"], string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  canceled: "Canceled",
  failed: "Failed",
};

const runStatusTone: Record<TestRunRecord["status"], "success" | "warning" | "danger" | "neutral"> = {
  queued: "neutral",
  running: "warning",
  completed: "success",
  canceled: "neutral",
  failed: "danger",
};

const itemStatusTone: Record<RunItemStatus, "success" | "warning" | "danger" | "neutral"> = {
  passed: "success",
  failed: "danger",
  skipped: "neutral",
  blocked: "warning",
  not_run: "neutral",
};

const quickStatusActions: Array<{ key: "passed" | "failed" | "skipped"; label: string }> = [
  { key: "passed", label: "Passed" },
  { key: "failed", label: "Failed" },
  { key: "skipped", label: "Skipped" },
];

type RowActionMenuState = {
  itemId: string;
  x: number;
  y: number;
};

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No date";
  return parsed.toLocaleString();
}

function formatDuration(value?: number | null) {
  if (!value || value <= 0) return "No duration";
  if (value < 1000) return `${value} ms`;
  return `${Math.round(value / 1000)}s`;
}

function formatMetricsDuration(value?: string | number | null) {
  const parsed = Number(value ?? NaN);
  if (!Number.isFinite(parsed) || parsed <= 0) return "No duration";
  return formatDuration(parsed);
}

function formatSize(value?: number | string | null) {
  const parsed = Number(value ?? NaN);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let size = parsed;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getRunTitle(run: TestRunRecord) {
  if (run.name?.trim()) return run.name.trim();
  return `Run ${run.id.slice(0, 6)}`;
}

export function TestRunsWorkspace() {
  const { data: session } = useSession();

  const [query, setQuery] = useState("");
  const [runs, setRuns] = useState<TestRunRecord[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("test-cases");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRun, setEditingRun] = useState<TestRunRecord | null>(null);

  const [items, setItems] = useState<RunItemRecord[]>([]);
  const [itemEdits, setItemEdits] = useState<Record<string, RunItemEditState>>({});
  const [dirtyItems, setDirtyItems] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [savingItems, setSavingItems] = useState(false);

  const [artifactGroups, setArtifactGroups] = useState<ArtifactByTestGroupRecord[]>([]);
  const [expandedArtifactTests, setExpandedArtifactTests] = useState<Set<string>>(new Set());
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [artifactsError, setArtifactsError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TestRunMetricsRecord | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [refreshingMetrics, setRefreshingMetrics] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [plans, setPlans] = useState<TestPlanOption[]>([]);
  const [suites, setSuites] = useState<TestSuiteOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [executionModalOpen, setExecutionModalOpen] = useState(false);
  const [executionItem, setExecutionItem] = useState<RunItemRecord | null>(null);
  const [executionStartNew, setExecutionStartNew] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<RunItemRecord | null>(null);
  const [historyItems, setHistoryItems] = useState<ExecutionHistoryItemRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [rowActionMenu, setRowActionMenu] = useState<RowActionMenuState | null>(null);
  const rowActionMenuRef = useRef<HTMLDivElement | null>(null);
  const [isMarkAsSubmenuOpen, setIsMarkAsSubmenuOpen] = useState(false);
  const [resetConfirmItem, setResetConfirmItem] = useState<RunItemRecord | null>(null);
  const [resettingItem, setResettingItem] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const isReadOnlyGlobal = useMemo(
    () =>
      session?.user?.globalRoles?.some(
        (role) => role === "support" || role === "auditor",
      ) ?? false,
    [session?.user?.globalRoles],
  );

  const canManage = !isReadOnlyGlobal;

  const closeRowActionMenu = useCallback(() => {
    setRowActionMenu(null);
    setIsMarkAsSubmenuOpen(false);
  }, []);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  );

  const selectedMenuItem = useMemo(
    () => items.find((item) => item.id === rowActionMenu?.itemId) ?? null,
    [items, rowActionMenu?.itemId],
  );

  const rowActionMenuPosition = useMemo(() => {
    if (!rowActionMenu) return null;
    if (typeof window === "undefined") {
      return { left: rowActionMenu.x, top: rowActionMenu.y };
    }

    const menuWidth = 220;
    const menuHeight = 220;
    const padding = 8;
    const left = Math.max(
      padding,
      Math.min(rowActionMenu.x, window.innerWidth - menuWidth - padding),
    );
    const top = Math.max(
      padding,
      Math.min(rowActionMenu.y, window.innerHeight - menuHeight - padding),
    );
    return { left, top };
  }, [rowActionMenu]);

  const totalArtifacts = useMemo(
    () =>
      artifactGroups.reduce(
        (sum, group) =>
          sum + group.executions.reduce((executionSum, execution) => executionSum + execution.artifacts.length, 0),
        0,
      ),
    [artifactGroups],
  );

  const metricsCards = useMemo(() => {
    if (!metrics) return [];
    return [
      { key: "total", label: "Total", value: metrics.total },
      { key: "passed", label: "Passed", value: metrics.passed },
      { key: "failed", label: "Failed", value: metrics.failed },
      { key: "skipped", label: "Skipped", value: metrics.skipped },
      { key: "blocked", label: "Blocked", value: metrics.blocked },
      { key: "notRun", label: "Not Run", value: metrics.notRun },
      { key: "passRate", label: "Pass rate", value: `${metrics.passRate}%` },
      { key: "durationMs", label: "Duration", value: formatMetricsDuration(metrics.durationMs) },
    ];
  }, [metrics]);

  const metricsBars = useMemo(() => {
    if (!metrics) return [];
    const total = metrics.total > 0 ? metrics.total : 0;
    const toPercent = (value: number) =>
      total > 0 ? Math.round((value / total) * 100) : 0;
    return [
      { key: "passed", label: "Passed", count: metrics.passed, percent: toPercent(metrics.passed), color: "#22C55E" },
      { key: "failed", label: "Failed", count: metrics.failed, percent: toPercent(metrics.failed), color: "#EF4444" },
      { key: "skipped", label: "Skipped", count: metrics.skipped, percent: toPercent(metrics.skipped), color: "#94A3B8" },
      { key: "blocked", label: "Blocked", count: metrics.blocked, percent: toPercent(metrics.blocked), color: "#F59E0B" },
      { key: "notRun", label: "Not Run", count: metrics.notRun, percent: toPercent(metrics.notRun), color: "#3B82F6" },
    ];
  }, [metrics]);

  const fetchRuns = useCallback(async () => {
    setLoadingRuns(true);
    setRunsError(null);

    try {
      const allRuns: TestRunRecord[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(LIST_PAGE_SIZE),
          query,
        });
        const response = await fetch(`/api/test-runs?${params.toString()}`);
        const payload = await parseJsonSafely<TestRunsResponse & { message?: string }>(response);
        if (!response.ok) {
          throw new Error(payload?.message || "Could not load test runs.");
        }
        if (!payload) {
          throw new Error("Could not load test runs.");
        }

        allRuns.push(...payload.items);
        hasMore = page * payload.pageSize < payload.total;
        page += 1;
      }

      setRuns(allRuns);
    } catch (fetchError) {
      setRunsError(
        fetchError instanceof Error ? fetchError.message : "Could not load test runs.",
      );
    } finally {
      setLoadingRuns(false);
    }
  }, [query]);

  const fetchOptions = useCallback(async () => {
    setOptionsError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        query: "",
      });
      const [projectsResponse, plansResponse, suitesResponse] = await Promise.all([
        fetch(`/api/projects?${params.toString()}`),
        fetch(`/api/test-plans?${params.toString()}`),
        fetch(`/api/test-suites?${params.toString()}`),
      ]);

      const [projectsPayload, plansPayload, suitesPayload] = await Promise.all([
        parseJsonSafely<ProjectsResponse & { message?: string }>(projectsResponse),
        parseJsonSafely<TestPlansResponse & { message?: string }>(plansResponse),
        parseJsonSafely<TestSuitesResponse & { message?: string }>(suitesResponse),
      ]);

      if (!projectsResponse.ok) {
        throw new Error(projectsPayload?.message || "Could not load projects.");
      }
      if (!plansResponse.ok) {
        throw new Error(plansPayload?.message || "Could not load plans.");
      }
      if (!suitesResponse.ok) {
        throw new Error(suitesPayload?.message || "Could not load suites.");
      }
      if (!projectsPayload || !plansPayload || !suitesPayload) {
        throw new Error("Could not load supporting data.");
      }

      setProjects(
        projectsPayload.items.map((project) => ({
          id: project.id,
          key: project.key,
          name: project.name,
        })),
      );
      setPlans(
        plansPayload.items.map((plan) => ({
          id: plan.id,
          name: plan.name,
          projectId: plan.projectId,
          projectKey: plan.project.key,
        })),
      );
      setSuites(
        suitesPayload.items.map((suite) => ({
          id: suite.id,
          name: suite.name,
          testPlanId: suite.testPlan.id,
          testPlanName: suite.testPlan.name,
          projectId: suite.testPlan.project.id,
          projectKey: suite.testPlan.project.key,
        })),
      );
    } catch (fetchError) {
      setOptionsError(
        fetchError instanceof Error ? fetchError.message : "Could not load supporting data.",
      );
    }
  }, []);

  const fetchRunItems = useCallback(async (runId: string) => {
    setLoadingItems(true);
    setItemsError(null);

    try {
      const allItems: RunItemRecord[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(ITEM_PAGE_SIZE),
        });
        const response = await fetch(`/api/test-runs/${runId}/items?${params.toString()}`);
        const payload = await parseJsonSafely<{
          items: RunItemRecord[];
          total: number;
          page: number;
          pageSize: number;
          message?: string;
        }>(response);

        if (!response.ok) {
          throw new Error(payload?.message || "Could not load run items.");
        }
        if (!payload) {
          throw new Error("Could not load run items.");
        }

        allItems.push(...payload.items);
        hasMore = page * payload.pageSize < payload.total;
        page += 1;
      }

      // Discard stale response if user already switched to a different run
      if (activeRunIdRef.current !== runId) return;

      const normalizedItems = allItems.map((item) => ({
        ...item,
        attemptCount: item._count?.executions ?? item.attemptCount ?? 0,
        latestAttemptNumber: item.currentExecution?.attemptNumber ?? item.latestAttemptNumber ?? null,
        currentExecutionId: item.currentExecution?.id ?? item.currentExecutionId ?? null,
      }));

      setItems(normalizedItems);
      setItemEdits(
        Object.fromEntries(
          normalizedItems.map((item) => [item.id, { status: item.status }]),
        ),
      );
      setDirtyItems(new Set());
    } catch (fetchError) {
      if (activeRunIdRef.current !== runId) return;
      setItemsError(
        fetchError instanceof Error ? fetchError.message : "Could not load run items.",
      );
    } finally {
      if (activeRunIdRef.current === runId) setLoadingItems(false);
    }
  }, []);

  const fetchRunArtifacts = useCallback(async (runId: string) => {
    setLoadingArtifacts(true);
    setArtifactsError(null);

    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: String(ARTIFACT_PAGE_SIZE),
        groupBy: "test",
      });
      const response = await fetch(`/api/test-runs/${runId}/artifacts?${params.toString()}`);
      const payload = await parseJsonSafely<{
        groups?: ArtifactByTestGroupRecord[];
        message?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(payload?.message || "Could not load artifacts.");
      }
      if (!payload) {
        throw new Error("Could not load artifacts.");
      }

      if (activeRunIdRef.current !== runId) return;

      const groups = (payload.groups ?? []).filter((group) => group.totalArtifacts > 0);
      setArtifactGroups(groups);
      setExpandedArtifactTests((previous) => {
        const next = new Set<string>();
        for (const group of groups) {
          if (previous.has(group.testId)) {
            next.add(group.testId);
          }
        }
        return next;
      });
    } catch (fetchError) {
      if (activeRunIdRef.current !== runId) return;
      setArtifactsError(
        fetchError instanceof Error ? fetchError.message : "Could not load artifacts.",
      );
    } finally {
      if (activeRunIdRef.current === runId) setLoadingArtifacts(false);
    }
  }, []);

  const fetchRunMetrics = useCallback(async (runId: string, refresh = false) => {
    if (refresh) {
      setRefreshingMetrics(true);
    } else {
      setLoadingMetrics(true);
    }
    setMetricsError(null);

    try {
      const params = new URLSearchParams();
      if (refresh) {
        params.set("refresh", "true");
      }
      const suffix = params.toString();
      const response = await fetch(`/api/test-runs/${runId}/metrics${suffix ? `?${suffix}` : ""}`);
      const payload = await parseJsonSafely<(TestRunMetricsRecord & { message?: string }) | { message?: string }>(response);
      if (!response.ok) {
        throw new Error(("message" in (payload ?? {}) ? payload?.message : undefined) || "Could not load metrics.");
      }
      if (!payload || !("total" in payload)) {
        throw new Error("Could not load metrics.");
      }

      if (activeRunIdRef.current !== runId) return;
      setMetrics(payload as TestRunMetricsRecord);
    } catch (fetchError) {
      if (activeRunIdRef.current !== runId) return;
      setMetricsError(
        fetchError instanceof Error ? fetchError.message : "Could not load metrics.",
      );
    } finally {
      if (activeRunIdRef.current !== runId) return;
      if (refresh) {
        setRefreshingMetrics(false);
      } else {
        setLoadingMetrics(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  useEffect(() => {
    setSelectedRunId((current) => {
      if (current && runs.some((run) => run.id === current)) return current;
      return runs[0]?.id ?? null;
    });
  }, [runs]);

  useEffect(() => {
    const resolvedRunId = selectedRunId ?? runs[0]?.id ?? null;
    activeRunIdRef.current = resolvedRunId;

    if (!resolvedRunId) {
      setItems([]);
      setItemEdits({});
      setDirtyItems(new Set());
      setArtifactGroups([]);
      setExpandedArtifactTests(new Set());
      setMetrics(null);
      setMetricsError(null);
      setLoadingMetrics(false);
      setRefreshingMetrics(false);
      return;
    }

    // Clear previous data immediately to avoid showing stale items
    setItems([]);
    setItemEdits({});
    setDirtyItems(new Set());
    setArtifactGroups([]);
    setMetrics(null);
    setMetricsError(null);
    setLoadingMetrics(false);
    setRefreshingMetrics(false);

    void fetchRunItems(resolvedRunId);
    void fetchRunArtifacts(resolvedRunId);
  }, [selectedRunId, runs, fetchRunItems, fetchRunArtifacts]);

  useEffect(() => {
    if (activeTab !== "metrics") return;
    const resolvedRunId = selectedRunId ?? runs[0]?.id ?? null;
    if (!resolvedRunId) return;
    void fetchRunMetrics(resolvedRunId);
  }, [activeTab, selectedRunId, runs, fetchRunMetrics]);

  useEffect(() => {
    if (!rowActionMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rowActionMenuRef.current) return;
      if (rowActionMenuRef.current.contains(event.target as Node)) return;
      closeRowActionMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRowActionMenu();
    };

    const closeOnViewportChange = () => closeRowActionMenu();

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", closeOnViewportChange, true);
    window.addEventListener("resize", closeOnViewportChange);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [closeRowActionMenu, rowActionMenu]);

  useEffect(() => {
    if (!rowActionMenu) return;
    const first = rowActionMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
  }, [rowActionMenu]);

  useEffect(() => {
    closeRowActionMenu();
  }, [activeTab, closeRowActionMenu, selectedRunId]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (exportMenuRef.current?.contains(event.target as Node)) return;
      setExportMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [exportMenuOpen]);

  const handleExport = useCallback((mode: string, format: string) => {
    setExportMenuOpen(false);
    if (!selectedRunId) return;
    window.open(`/api/test-runs/${selectedRunId}/export?format=${format}&mode=${mode}`, "_blank");
  }, [selectedRunId]);

  const handleQuickStatus = useCallback((itemId: string, status: "passed" | "failed" | "skipped" | "not_run") => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;

    setItemEdits((prev) => ({
      ...prev,
      [itemId]: { status },
    }));

    setDirtyItems((prev) => {
      const next = new Set(prev);
      if (status === item.status) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, [items]);

  const openRowActionMenu = useCallback((itemId: string, x: number, y: number) => {
    setRowActionMenu({ itemId, x, y });
    setIsMarkAsSubmenuOpen(false);
  }, []);

  const toggleArtifactTestGroup = useCallback((testId: string) => {
    setExpandedArtifactTests((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  }, []);

  const handleOpenRowActionMenuFromButton = useCallback(
    (itemId: string, target: HTMLElement) => {
      const bounds = target.getBoundingClientRect();
      openRowActionMenu(itemId, bounds.left, bounds.bottom + 6);
    },
    [openRowActionMenu],
  );

  const handleSaveItems = async () => {
    if (!selectedRunId || dirtyItems.size === 0) return;

    setSavingItems(true);
    setItemsError(null);
    try {
      const payload = {
        items: items
          .filter((item) => dirtyItems.has(item.id))
          .map((item) => {
            const edit = itemEdits[item.id];
            const nextStatus = edit?.status ?? item.status;
            const shouldStampExecution = nextStatus !== "not_run";
            return {
              testCaseId: item.testCase.id,
              status: nextStatus,
              durationMs: item.durationMs,
              executedById: shouldStampExecution ? (session?.user?.id ?? item.executedBy?.id ?? null) : null,
              executedAt: shouldStampExecution ? new Date().toISOString() : null,
              errorMessage: item.errorMessage,
            };
          }),
      };

      const response = await fetch(`/api/test-runs/${selectedRunId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Could not save run item changes.");
      }

      await Promise.all([fetchRunItems(selectedRunId), fetchRuns()]);
    } catch (saveError) {
      setItemsError(
        saveError instanceof Error ? saveError.message : "Could not save run item changes.",
      );
    } finally {
      setSavingItems(false);
    }
  };

  const handleCreate = () => {
    if (!canManage) return;
    setEditingRun(null);
    setModalOpen(true);
  };

  const handleEditRun = () => {
    if (!canManage || !selectedRun) return;
    setEditingRun(selectedRun);
    setModalOpen(true);
  };

  const handleSaveRun = async (payload: TestRunPayload, runId?: string) => {
    const method = runId ? "PUT" : "POST";
    const endpoint = runId ? `/api/test-runs/${runId}` : "/api/test-runs";
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { message?: string; id?: string };
    if (!response.ok) {
      throw new Error(data.message || "Could not save test run.");
    }
    await fetchRuns();
    if (runId) {
      setSelectedRunId(runId);
    } else if (data.id) {
      setSelectedRunId(data.id);
    }
  };

  const handleDeleteRun = async (run: TestRunRecord) => {
    const response = await fetch(`/api/test-runs/${run.id}`, {
      method: "DELETE",
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(data.message || "Could not delete test run.");
    }

    await fetchRuns();
    setSelectedRunId((current) => (current === run.id ? null : current));
  };

  const handleOpenExecution = useCallback((item: RunItemRecord) => {
    if (!canManage) return;
    const hasExistingExecution = Boolean(item.currentExecutionId) || (item.attemptCount ?? 0) > 0;
    setExecutionStartNew(hasExistingExecution);
    setExecutionItem(item);
    setExecutionModalOpen(true);
  }, [canManage]);

  const handleSelectRowStatus = useCallback((status: "passed" | "failed" | "skipped" | "not_run") => {
    if (!selectedMenuItem) return;
    handleQuickStatus(selectedMenuItem.id, status);
    closeRowActionMenu();
  }, [closeRowActionMenu, handleQuickStatus, selectedMenuItem]);

  const handleSelectExecuteCase = useCallback(() => {
    if (!selectedMenuItem) return;
    void handleOpenExecution(selectedMenuItem);
    closeRowActionMenu();
  }, [closeRowActionMenu, handleOpenExecution, selectedMenuItem]);

  const handleConfirmReset = useCallback(async () => {
    if (!selectedRunId || !resetConfirmItem) return;

    setResettingItem(true);
    setItemsError(null);
    try {
      const response = await fetch(`/api/test-runs/${selectedRunId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              testCaseId: resetConfirmItem.testCase.id,
              status: "not_run",
              durationMs: null,
              executedById: null,
              executedAt: null,
              errorMessage: null,
            },
          ],
        }),
      });
      const data = await parseJsonSafely<{ message?: string }>(response);
      if (!response.ok) {
        throw new Error(data?.message || "Could not reset test case.");
      }

      await Promise.all([
        fetchRunItems(selectedRunId),
        fetchRunArtifacts(selectedRunId),
        fetchRuns(),
      ]);
      setResetConfirmItem(null);
    } catch (resetError) {
      setItemsError(
        resetError instanceof Error ? resetError.message : "Could not reset test case.",
      );
    } finally {
      setResettingItem(false);
    }
  }, [fetchRunArtifacts, fetchRunItems, fetchRuns, resetConfirmItem, selectedRunId]);

  const handleSelectReset = useCallback(() => {
    if (!selectedMenuItem) return;
    setResetConfirmItem(selectedMenuItem);
    closeRowActionMenu();
  }, [closeRowActionMenu, selectedMenuItem]);

  const handleCreateExecution = useCallback(
    async (runId: string, runItemId: string): Promise<string> => {
      const createResponse = await fetch(`/api/test-runs/${runId}/items/${runItemId}/executions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "not_run" }),
      });
      const createPayload = await parseJsonSafely<{ id?: string; message?: string }>(createResponse);
      if (!createResponse.ok || !createPayload?.id) {
        throw new Error(createPayload?.message || "Could not create execution.");
      }
      return createPayload.id;
    },
    [],
  );

  const handleSaveExecution = useCallback(
    async (payload: {
      executionId: string | null;
      status: ExecutionStatus;
      durationMs: number;
      stepResults: Array<{ stepIndex: number; status: "passed" | "failed" | "not_run"; actualResult?: string | null; comment?: string | null }>;
      stepFiles: Record<number, File[]>;
    }) => {
      if (!selectedRunId || !executionItem) return;

      const uploadEntries = Object.entries(payload.stepFiles).flatMap(([stepIndex, files]) =>
        files.map((file) => ({
          file,
          metadata: { scope: "step" as const, stepIndex: Number(stepIndex) },
        })),
      );

      for (const entry of uploadEntries) {
        const formData = new FormData();
        formData.append("file", entry.file);
        formData.append("runItemId", executionItem.id);
        if (payload.executionId) {
          formData.append("executionId", payload.executionId);
        }
        formData.append("type", "screenshot");
        formData.append("metadata", JSON.stringify({ kind: "execution_evidence", ...entry.metadata }));
        formData.append("name", entry.file.name);

        const uploadResponse = await fetch(`/api/test-runs/${selectedRunId}/artifacts/upload`, {
          method: "POST",
          body: formData,
        });
        const uploadPayload = await parseJsonSafely<{ message?: string }>(uploadResponse);
        if (!uploadResponse.ok) {
          throw new Error(uploadPayload?.message || "Could not upload evidence.");
        }
      }

      if (!payload.executionId) {
        throw new Error("No execution ID provided. Cannot save execution.");
      }

      const saveResponse = await fetch(`/api/test-runs/${selectedRunId}/items/${executionItem.id}/executions/${payload.executionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: payload.status,
          durationMs: payload.durationMs,
          stepResults: payload.stepResults,
        }),
      });
      const savePayload = await parseJsonSafely<{ message?: string }>(saveResponse);
      if (!saveResponse.ok) {
        throw new Error(savePayload?.message || "Could not save execution.");
      }

      await Promise.all([
        fetchRunItems(selectedRunId),
        fetchRunArtifacts(selectedRunId),
        fetchRuns(),
      ]);
    },
    [executionItem, fetchRunArtifacts, fetchRunItems, fetchRuns, selectedRunId],
  );

  const loadRunItemExecutionsReadOnly = useCallback(async (runId: string, runItemId: string) => {
    const response = await fetch(`/api/test-runs/${runId}/items/${runItemId}/executions`);
    const payload = await parseJsonSafely<ExecutionHistoryResponse & { message?: string }>(response);
    if (!response.ok) {
      throw new Error(payload?.message || "Could not load execution history.");
    }
    if (!payload) {
      throw new Error("Could not load execution history.");
    }
    return payload;
  }, []);

  const loadRunItemExecutionsForExecutionModal = useCallback(async (runId: string, runItemId: string) => {
    try {
      return await loadRunItemExecutionsReadOnly(runId, runItemId);
    } catch {
      return {
        currentExecutionId: null,
        items: [],
      };
    }
  }, [loadRunItemExecutionsReadOnly]);

  const loadExecutionDetail = useCallback(async (runId: string, runItemId: string, executionId: string) => {
    const response = await fetch(`/api/test-runs/${runId}/items/${runItemId}/executions/${executionId}`);
    const payload = await parseJsonSafely<ExecutionDetailRecord & { message?: string }>(response);
    if (!response.ok) {
      throw new Error(payload?.message || "Could not load execution detail.");
    }
    if (!payload) {
      throw new Error("Could not load execution detail.");
    }
    return payload;
  }, []);

  const handleOpenExecutionHistory = useCallback(async (item: RunItemRecord) => {
    if (!selectedRunId) return;
    setHistoryModalOpen(true);
    setHistoryItem(item);
    setHistoryItems([]);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const payload = await loadRunItemExecutionsReadOnly(selectedRunId, item.id);
      setHistoryItems(payload.items);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Could not load execution history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [loadRunItemExecutionsReadOnly, selectedRunId]);

  const handleSelectViewExecutionHistory = useCallback(() => {
    if (!selectedMenuItem) return;
    void handleOpenExecutionHistory(selectedMenuItem);
    closeRowActionMenu();
  }, [closeRowActionMenu, handleOpenExecutionHistory, selectedMenuItem]);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      <aside className="flex w-[400px] shrink-0 flex-col border-r border-stroke bg-surface/50">
        <div className="flex items-center justify-between p-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Test Runs</h2>
            <p className="text-xs text-ink-muted">
              {loadingRuns ? "Loading runs..." : `Total: ${runs.length}`}
            </p>
          </div>
          {canManage ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-9 w-9 rounded-xl border-brand-300 bg-brand-50 p-0 text-brand-700 hover:bg-brand-100"
              onClick={handleCreate}
              aria-label="Create test run"
            >
              <IconPlus className="h-5 w-5 shrink-0 text-brand-700" />
            </Button>
          ) : null}
        </div>

        <div className="px-4 pb-2">
          <SearchInput
            placeholder="Search runs..."
            value={query}
            onChange={setQuery}
            containerClassName="w-full"
            aria-label="Search runs"
          />
        </div>

        {runsError ? (
          <div className="mx-4 mb-4 rounded-lg border border-danger-500/20 bg-danger-500/10 px-3 py-2.5 text-sm text-danger-600">
            <div className="flex items-center justify-between gap-3">
              <span>{runsError}</span>
              <Button size="xs" variant="critical" onClick={() => void fetchRuns()}>
                Retry
              </Button>
            </div>
          </div>
        ) : null}
        {optionsError ? (
          <div className="mx-4 mb-4 rounded-lg border border-warning-500/20 bg-warning-500/10 px-3 py-2.5 text-sm text-warning-500">
            <div className="flex items-center justify-between gap-3">
              <span>{optionsError}</span>
              <Button size="xs" variant="soft" onClick={() => void fetchOptions()}>
                Reload catalogs
              </Button>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-1">
          {!loadingRuns && runs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stroke-strong bg-surface-muted/50 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-ink">No test runs found.</p>
              <p className="mt-1 text-xs text-ink-muted">Adjust search or create new runs in Test Runs.</p>
            </div>
          ) : null}

          <div className="space-y-2">
            {runs.map((run) => {
              const isSelected = selectedRunId === run.id;
              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedRunId(run.id)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                    isSelected
                      ? "border-brand-300 bg-brand-50/35"
                      : "border-stroke bg-surface-elevated hover:border-brand-200 hover:bg-brand-50/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{getRunTitle(run)}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {run.project.key} · {run.suite?.name ?? run.testPlan?.name ?? "No suite"}
                      </p>
                    </div>
                    <Badge tone={runStatusTone[run.status]}>{runStatusLabel[run.status]}</Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface">
        {!selectedRun ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700">
                <IconFolder className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-ink">
                Test runs workspace
              </h3>
              <p className="mt-2 text-sm text-ink-muted">
                Select a run on the left to review its test cases and artifacts.
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="border-b border-stroke px-8 py-6">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-ink">{getRunTitle(selectedRun)}</h2>
                {canManage ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="quiet"
                    className="h-8 w-8 rounded-lg p-0 text-ink-soft hover:bg-surface-muted hover:text-ink"
                    onClick={handleEditRun}
                    aria-label={`Edit test run ${getRunTitle(selectedRun)}`}
                    title="Edit test run"
                  >
                    <IconEdit className="h-4 w-4 shrink-0" />
                  </Button>
                ) : null}
                <div className="relative" ref={exportMenuRef}>
                  <Button
                    type="button"
                    size="sm"
                    variant="quiet"
                    className="flex h-8 items-center gap-0.5 rounded-lg px-1.5 text-ink-soft hover:bg-surface-muted hover:text-ink"
                    onClick={() => setExportMenuOpen((o) => !o)}
                    aria-label="Export test run"
                    title="Export"
                  >
                    <IconDownload className="h-4 w-4" />
                    <IconChevronDown className="h-3 w-3" />
                  </Button>
                  {exportMenuOpen && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-stroke bg-surface-elevated p-1 shadow-lg">
                      {[
                        { label: "Simple PDF", mode: "simple", format: "pdf" },
                        { label: "Simple HTML", mode: "simple", format: "html" },
                        { label: "Complete PDF", mode: "complete", format: "pdf" },
                        { label: "Complete HTML", mode: "complete", format: "html" },
                      ].map((opt) => (
                        <button
                          key={`${opt.mode}-${opt.format}`}
                          type="button"
                          className="w-full rounded-md px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
                          onClick={() => handleExport(opt.mode, opt.format)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-1.5 text-sm text-ink-muted">
                {selectedRun.project.key} · {selectedRun.testPlan?.name ?? "No plan"} · {selectedRun.suite?.name ?? "No suite"}
              </p>
            </header>

            <div className="flex items-center gap-2 border-b border-stroke px-8 py-3">
              <button
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  activeTab === "test-cases"
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                )}
                onClick={() => setActiveTab("test-cases")}
              >
                Test Cases
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  activeTab === "metrics"
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                )}
                onClick={() => setActiveTab("metrics")}
              >
                Metrics
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  activeTab === "artifacts"
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                )}
                onClick={() => setActiveTab("artifacts")}
              >
                Artifacts
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {activeTab === "test-cases" ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-stroke bg-surface p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-ink-soft">
                        {loadingItems ? "Updating..." : `Total: ${items.length}`}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-ink-muted">
                        <span>
                          {dirtyItems.size > 0
                            ? `${dirtyItems.size} pending changes`
                            : "No pending changes"}
                        </span>
                        {canManage ? (
                          <Button
                            size="sm"
                            onClick={() => void handleSaveItems()}
                            disabled={savingItems || dirtyItems.size === 0}
                          >
                            {savingItems ? "Saving..." : "Save changes"}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {itemsError ? (
                      <div className="mb-3 rounded-lg border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-600">
                        {itemsError}
                      </div>
                    ) : null}

                    <TableShell
                      loading={loadingItems}
                      hasItems={items.length > 0}
                      emptyTitle="No run items found."
                      emptyDescription="There are no test cases linked to this run yet."
                      desktopContainerClassName="hidden md:block"
                      mobileContainerClassName="grid gap-3 md:hidden"
                      desktop={(
                        <table className="w-full border-collapse text-[13px]">
                          <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
                            <tr className="text-left text-[13px] font-medium text-ink-soft">
                              <th className="px-3 py-2">Case</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Duration</th>
                              <th className="px-3 py-2">Executed by</th>
                              <th className="px-3 py-2">Executed at</th>
                              <th className="px-3 py-2">Runs</th>
                              <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => {
                              const edit = itemEdits[item.id] ?? { status: item.status };
                              return (
                                <tr
                                  key={item.id}
                                  className="transition-colors hover:bg-brand-50/35"
                                  onContextMenu={(event) => {
                                    event.preventDefault();
                                    openRowActionMenu(item.id, event.clientX, event.clientY);
                                  }}
                                >
                                  <td className="px-3 py-3">
                                    <p className="font-semibold text-ink">{item.testCase.title}</p>
                                    <p className="text-xs text-ink-muted">{item.testCase.externalKey ?? "No key"}</p>
                                  </td>
                                  <td className="px-3 py-3">
                                    <Badge tone={itemStatusTone[edit.status]}>
                                      {edit.status.replace("_", " ")}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-3 text-ink-muted">{formatDuration(item.durationMs)}</td>
                                  <td className="px-3 py-3 text-ink-muted">
                                    {item.executedBy?.fullName ?? item.executedBy?.email ?? "No executor"}
                                  </td>
                                  <td className="px-3 py-3 text-ink-muted">{formatDate(item.executedAt)}</td>
                                  <td className="px-3 py-3 text-ink-muted">
                                    {item.attemptCount ?? 0} runs
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        size="xs"
                                        variant="quiet"
                                        className="h-7 w-8 px-0"
                                        aria-label={`Open actions menu for ${item.testCase.title}`}
                                        onClick={(event) => handleOpenRowActionMenuFromButton(item.id, event.currentTarget)}
                                      >
                                        <IconMenu className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                      mobile={(
                        <>
                          {items.map((item) => {
                            const edit = itemEdits[item.id] ?? { status: item.status };
                            return (
                              <div
                                key={item.id}
                                className="rounded-lg border border-stroke bg-surface-elevated p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-ink">{item.testCase.title}</p>
                                    <p className="text-xs text-ink-muted">{item.testCase.externalKey ?? "No key"}</p>
                                  </div>
                                  <Badge tone={itemStatusTone[edit.status]}>
                                    {edit.status.replace("_", " ")}
                                  </Badge>
                                </div>
                                <div className="mt-3 grid gap-1 text-xs text-ink-muted">
                                  <p>Duration: {formatDuration(item.durationMs)}</p>
                                  <p>Executed by: {item.executedBy?.fullName ?? item.executedBy?.email ?? "No executor"}</p>
                                  <p>Executed at: {formatDate(item.executedAt)}</p>
                                  <p>Runs: {item.attemptCount ?? 0}</p>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-1">
                                  <Button
                                    size="xs"
                                    variant="quiet"
                                    className="h-7 px-2.5"
                                    aria-label={`Open actions menu for ${item.testCase.title}`}
                                    onClick={(event) => handleOpenRowActionMenuFromButton(item.id, event.currentTarget)}
                                  >
                                    <IconMenu className="h-4 w-4" />
                                    <span className="ml-1">Actions</span>
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    />
                  </div>
                </div>
              ) : activeTab === "metrics" ? (
                <div className="space-y-4">
                  {metricsError ? (
                    <div className="rounded-lg border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-600">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>{metricsError}</span>
                        {selectedRunId ? (
                          <Button
                            size="xs"
                            variant="quiet"
                            className="h-7 px-2.5"
                            onClick={() => void fetchRunMetrics(selectedRunId)}
                          >
                            Retry
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-medium text-ink-soft">
                      {loadingMetrics ? "Updating..." : `Total: ${metrics?.total ?? 0}`}
                    </div>
                    <Button
                      size="xs"
                      variant="quiet"
                      className="h-7 px-2.5"
                      disabled={!selectedRunId || refreshingMetrics}
                      onClick={() => {
                        if (!selectedRunId) return;
                        void fetchRunMetrics(selectedRunId, true);
                      }}
                    >
                      {refreshingMetrics ? "Refreshing..." : "Refresh metrics"}
                    </Button>
                  </div>

                  {loadingMetrics ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <div key={`metrics-skeleton-${index}`} className="h-20 animate-pulse rounded-lg bg-surface-muted" />
                      ))}
                    </div>
                  ) : !metrics ? (
                    <div className="rounded-lg border border-stroke px-4 py-8 text-center text-sm text-ink-muted">
                      No metrics available for this run.
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {metricsCards.map((card) => (
                          <div key={card.key} className="rounded-lg border border-stroke bg-surface-elevated p-3">
                            <p className="text-xs text-ink-soft">{card.label}</p>
                            <p className="mt-1 text-base font-semibold text-ink">{card.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3 rounded-lg border border-stroke bg-surface-elevated p-4">
                        <p className="text-sm font-semibold text-ink">Status distribution</p>
                        <div className="grid gap-4 md:grid-cols-[minmax(220px,300px)_1fr] md:items-center">
                          <div className="relative h-[220px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={220} minHeight={220}>
                              <PieChart>
                                <Pie
                                  data={metricsBars}
                                  dataKey="count"
                                  nameKey="label"
                                  innerRadius={52}
                                  outerRadius={82}
                                  paddingAngle={2}
                                  strokeWidth={0}
                                >
                                  {metricsBars.map((entry) => (
                                    <Cell key={entry.key} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value: number | string, name: string, item) => {
                                    const percent = (item?.payload as { percent?: number } | undefined)?.percent ?? 0;
                                    return [`${value} (${percent}%)`, name];
                                  }}
                                  contentStyle={{
                                    backgroundColor: "var(--surface-elevated)",
                                    border: "1px solid var(--stroke)",
                                    borderRadius: 8,
                                    fontSize: 12,
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-2xl font-bold text-ink">{metrics.total}</span>
                              <span className="text-[10px] font-medium text-ink-muted">Total</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {metricsBars.map((entry) => (
                              <div key={entry.key} className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                  {entry.label}
                                </span>
                                <span>{entry.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {artifactsError ? (
                    <div className="rounded-lg border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-600">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>{artifactsError}</span>
                        {selectedRunId ? (
                          <Button
                            size="xs"
                            variant="quiet"
                            className="h-7 px-2.5"
                            onClick={() => void fetchRunArtifacts(selectedRunId)}
                          >
                            Retry
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="text-xs font-medium text-ink-soft">
                    {loadingArtifacts ? "Updating..." : `Total: ${totalArtifacts}`}
                  </div>
                  <div className="divide-y divide-stroke">
                    {loadingArtifacts ? (
                      <div className="space-y-2 py-2">
                        <div className="h-12 animate-pulse rounded-md bg-surface-muted" />
                        <div className="h-12 animate-pulse rounded-md bg-surface-muted" />
                        <div className="h-12 animate-pulse rounded-md bg-surface-muted" />
                      </div>
                    ) : artifactGroups.length === 0 ? (
                      <div className="py-6 text-center text-sm text-ink-muted">
                        No artifacts found.
                      </div>
                    ) : (
                      artifactGroups.map((group) => {
                        const isExpanded = expandedArtifactTests.has(group.testId);
                        const panelId = `artifact-group-${group.testId}`;
                        return (
                          <div key={group.testId}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-brand-50/20"
                              aria-expanded={isExpanded}
                              aria-controls={panelId}
                              onClick={() => toggleArtifactTestGroup(group.testId)}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-ink">{group.testName}</p>
                                <p className="text-xs text-ink-muted">
                                  {group.totalArtifacts} artifact{group.totalArtifacts === 1 ? "" : "s"} · Last update {formatDate(group.lastArtifactAt)}
                                </p>
                              </div>
                              {isExpanded ? <IconChevronDown className="h-4 w-4 text-ink-muted" /> : <IconChevronRight className="h-4 w-4 text-ink-muted" />}
                            </button>

                            {isExpanded ? (
                              <div id={panelId} className="space-y-3 border-t border-stroke py-3">
                                {group.executions.map((execution, executionIndex) => (
                                  <div key={`${execution.runId ?? executionIndex}-${execution.runLabel}`}>
                                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                                      <span className="font-semibold text-ink">{execution.runLabel}</span>
                                      <span>{execution.status ? execution.status.replaceAll("_", " ") : "unknown status"}</span>
                                      <span>·</span>
                                      <span>{formatDate(execution.executedAt)}</span>
                                    </div>
                                    <div className="overflow-hidden rounded-md border border-stroke">
                                      <table className="w-full border-collapse text-[13px]">
                                        <thead className="bg-surface-muted">
                                          <tr className="text-left text-xs font-medium text-ink-soft">
                                            <th className="px-3 py-2">Name</th>
                                            <th className="px-3 py-2">Type</th>
                                            <th className="px-3 py-2">Size</th>
                                            <th className="px-3 py-2">Created</th>
                                            <th className="px-3 py-2 text-right">Link</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {execution.artifacts.map((artifact) => (
                                            <tr key={artifact.id} className="border-t border-stroke first:border-0">
                                              <td className="px-3 py-2">
                                                <p className="font-semibold text-ink">
                                                  {artifact.name?.trim() || `Artifact ${artifact.id.slice(0, 8)}`}
                                                </p>
                                                <p className="text-xs text-ink-muted">{artifact.mimeType ?? "Unknown mime"}</p>
                                              </td>
                                              <td className="px-3 py-2 text-ink-muted">{artifact.type ?? "other"}</td>
                                              <td className="px-3 py-2 text-ink-muted">{formatSize(artifact.sizeBytes)}</td>
                                              <td className="px-3 py-2 text-ink-muted">{formatDate(artifact.createdAt)}</td>
                                              <td className="px-3 py-2 text-right">
                                                <a
                                                  href={artifact.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-sm font-semibold text-brand-700 underline-offset-2 hover:underline"
                                                >
                                                  Open
                                                </a>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {rowActionMenu && selectedMenuItem && rowActionMenuPosition ? (
        <div
          ref={rowActionMenuRef}
          role="menu"
          aria-label={`Actions for ${selectedMenuItem.testCase.title}`}
          className="fixed z-50 min-w-[220px] rounded-lg border border-stroke bg-surface-elevated p-1.5 shadow-lg"
          style={{ top: rowActionMenuPosition.top, left: rowActionMenuPosition.left }}
          onKeyDown={(event) => {
            const focusable = Array.from(
              rowActionMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
            );
            if (focusable.length === 0) return;

            const currentIndex = focusable.findIndex((button) => button === document.activeElement);
            if (event.key === "ArrowDown") {
              event.preventDefault();
              const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % focusable.length;
              focusable[nextIndex]?.focus();
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              const nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
              focusable[nextIndex]?.focus();
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              (document.activeElement as HTMLButtonElement | null)?.click();
            } else if (event.key === "Escape") {
              event.preventDefault();
              closeRowActionMenu();
            }
          }}
        >
          {canManage ? (
            <>
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={isMarkAsSubmenuOpen}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm",
                  "text-ink hover:bg-surface-muted",
                )}
                onClick={() => setIsMarkAsSubmenuOpen((open) => !open)}
              >
                <span>Mark as</span>
                <IconChevronRight className={cn("h-4 w-4 transition-transform", isMarkAsSubmenuOpen ? "rotate-90" : "")} />
              </button>
              {isMarkAsSubmenuOpen ? (
                <div className="ml-2 mt-1 space-y-1 border-l border-stroke pl-2">
                  {quickStatusActions.map((action) => {
                    const edit = itemEdits[selectedMenuItem.id] ?? { status: selectedMenuItem.status };
                    const isActive = edit.status === action.key;
                    return (
                      <button
                        key={action.key}
                        type="button"
                        role="menuitem"
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm",
                          isActive
                            ? "bg-brand-50 text-brand-700"
                            : "text-ink hover:bg-surface-muted",
                        )}
                        onClick={() => handleSelectRowStatus(action.key)}
                      >
                        <span>{action.label}</span>
                        {isActive ? <IconCheck className="h-4 w-4" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="my-1 h-px bg-stroke" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
                onClick={handleSelectExecuteCase}
              >
                Execute case
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm text-danger-600 hover:bg-danger-50 dark:text-danger-500 dark:hover:bg-danger-500/10"
                onClick={handleSelectReset}
              >
                Reset
              </button>
              <div className="my-1 h-px bg-stroke" />
            </>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
            onClick={handleSelectViewExecutionHistory}
          >
            View execution history
          </button>
        </div>
      ) : null}

      {canManage ? (
        <TestRunFormSheet
          open={modalOpen}
          run={editingRun}
          projects={projects}
          plans={plans}
          suites={suites}
          onClose={() => {
            setModalOpen(false);
            setEditingRun(null);
          }}
          onSave={handleSaveRun}
          onDelete={handleDeleteRun}
        />
      ) : null}

      <TestRunExecutionModal
        open={executionModalOpen}
        runId={selectedRunId}
        item={executionItem as ExecutionItemRecord | null}
        canManage={canManage}
        startNewExecution={executionStartNew}
        onClose={() => {
          setExecutionModalOpen(false);
          setExecutionItem(null);
          setExecutionStartNew(false);
        }}
        onCreateExecution={handleCreateExecution}
        onLoadExecutions={loadRunItemExecutionsForExecutionModal}
        onLoadExecutionDetail={loadExecutionDetail}
        onSave={handleSaveExecution}
      />

      <Modal
        open={historyModalOpen}
        onClose={() => {
          setHistoryModalOpen(false);
          setHistoryItem(null);
          setHistoryItems([]);
          setHistoryError(null);
        }}
        size="lg"
        closeOnEsc
        trapFocus
        title="Execution history"
      >
        <div className="space-y-3">
          {historyItem ? (
            <p className="text-sm text-ink-muted">
              {historyItem.testCase.title}
            </p>
          ) : null}
          {historyError ? (
            <div className="rounded-lg border border-danger-500/20 bg-danger-500/10 px-3 py-2 text-sm text-danger-600">
              {historyError}
            </div>
          ) : null}
          <div className="overflow-hidden rounded-lg border border-stroke">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-surface-elevated">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-ink-soft">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td className="px-3 py-5 text-center text-sm text-ink-muted" colSpan={3}>
                      Loading history...
                    </td>
                  </tr>
                ) : historyItems.length === 0 ? (
                  <tr>
                    <td className="px-3 py-5 text-center text-sm text-ink-muted" colSpan={3}>
                      No execution history yet.
                    </td>
                  </tr>
                ) : (
                  historyItems.map((entry) => (
                    <tr key={entry.id} className="border-t border-stroke">
                      <td className="px-3 py-2 text-ink">{`Execution #${entry.attemptNumber}`}</td>
                      <td className="px-3 py-2 text-ink-muted">{entry.status.replace("_", " ")}</td>
                      <td className="px-3 py-2 text-ink-muted">{formatDate(entry.completedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <ConfirmationDialog
        open={Boolean(resetConfirmItem)}
        title="Reset execution"
        description={`This will reset "${resetConfirmItem?.testCase.title ?? "this test case"}" and remove its execution artifacts. Do you want to continue?`}
        confirmText="Reset"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmReset}
        onCancel={() => {
          if (resettingItem) return;
          setResetConfirmItem(null);
        }}
        isConfirming={resettingItem}
      />
    </div>
  );
}
