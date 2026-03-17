"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { IconEdit, IconFolder, IconPlay, IconPlus } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RowActionButton } from "@/components/ui/RowActionButton";
import { SearchInput } from "@/components/ui/SearchInput";
import { TableShell } from "@/components/ui/TableShell";
import { TestRunFormSheet } from "./TestRunFormSheet";
import {
  TestRunExecutionModal,
  type ExecutionArtifactRecord,
  type ExecutionItemRecord,
  type ExecutionStatus,
} from "./TestRunExecutionModal";
import type { TestRunPayload, TestRunRecord, TestRunsResponse } from "./types";
import type { ProjectsResponse } from "@/components/projects/types";
import type { TestPlansResponse } from "@/components/test-plans/types";
import type { TestSuitesResponse } from "@/components/test-suites/types";
import { cn } from "@/lib/utils";

const LIST_PAGE_SIZE = 50;
const ITEM_PAGE_SIZE = 100;
const ARTIFACT_PAGE_SIZE = 100;

type WorkspaceTab = "test-cases" | "artifacts";

type RunItemStatus = "passed" | "failed" | "skipped" | "blocked" | "not_run";

type RunItemRecord = {
  id: string;
  status: RunItemStatus;
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
  type: string | null;
  name: string | null;
  url: string;
  mimeType: string | null;
  createdAt: string;
  sizeBytes?: number | string | null;
  metadata?: unknown;
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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("test-cases");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRun, setEditingRun] = useState<TestRunRecord | null>(null);

  const [items, setItems] = useState<RunItemRecord[]>([]);
  const [itemEdits, setItemEdits] = useState<Record<string, RunItemEditState>>({});
  const [dirtyItems, setDirtyItems] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [savingItems, setSavingItems] = useState(false);

  const [artifacts, setArtifacts] = useState<RunArtifactRecord[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [artifactsError, setArtifactsError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [plans, setPlans] = useState<TestPlanOption[]>([]);
  const [suites, setSuites] = useState<TestSuiteOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [executionModalOpen, setExecutionModalOpen] = useState(false);
  const [executionItem, setExecutionItem] = useState<RunItemRecord | null>(null);

  const isReadOnlyGlobal = useMemo(
    () =>
      session?.user?.globalRoles?.some(
        (role) => role === "support" || role === "auditor",
      ) ?? false,
    [session?.user?.globalRoles],
  );

  const canManage = !isReadOnlyGlobal;

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  );

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
        const payload = (await response.json()) as TestRunsResponse & { message?: string };
        if (!response.ok) {
          throw new Error(payload.message || "Could not load test runs.");
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

      const [projectsData, plansData, suitesData] = await Promise.all([
        projectsResponse.json(),
        plansResponse.json(),
        suitesResponse.json(),
      ]);

      if (!projectsResponse.ok) {
        throw new Error((projectsData as { message?: string }).message || "Could not load projects.");
      }
      if (!plansResponse.ok) {
        throw new Error((plansData as { message?: string }).message || "Could not load plans.");
      }
      if (!suitesResponse.ok) {
        throw new Error((suitesData as { message?: string }).message || "Could not load suites.");
      }

      const projectsPayload = projectsData as ProjectsResponse;
      const plansPayload = plansData as TestPlansResponse;
      const suitesPayload = suitesData as TestSuitesResponse;

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
        const payload = (await response.json()) as {
          items: RunItemRecord[];
          total: number;
          page: number;
          pageSize: number;
          message?: string;
        };

        if (!response.ok) {
          throw new Error(payload.message || "Could not load run items.");
        }

        allItems.push(...payload.items);
        hasMore = page * payload.pageSize < payload.total;
        page += 1;
      }

      setItems(allItems);
      setItemEdits(
        Object.fromEntries(
          allItems.map((item) => [item.id, { status: item.status }]),
        ),
      );
      setDirtyItems(new Set());
    } catch (fetchError) {
      setItemsError(
        fetchError instanceof Error ? fetchError.message : "Could not load run items.",
      );
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const fetchRunArtifacts = useCallback(async (runId: string) => {
    setLoadingArtifacts(true);
    setArtifactsError(null);

    try {
      const allArtifacts: RunArtifactRecord[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(ARTIFACT_PAGE_SIZE),
        });
        const response = await fetch(`/api/test-runs/${runId}/artifacts?${params.toString()}`);
        const payload = (await response.json()) as {
          items: RunArtifactRecord[];
          total: number;
          page: number;
          pageSize: number;
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message || "Could not load artifacts.");
        }

        allArtifacts.push(...payload.items);
        hasMore = page * payload.pageSize < payload.total;
        page += 1;
      }

      setArtifacts(allArtifacts);
    } catch (fetchError) {
      setArtifactsError(
        fetchError instanceof Error ? fetchError.message : "Could not load artifacts.",
      );
    } finally {
      setLoadingArtifacts(false);
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
    const resolvedRunId = selectedRunId ?? runs[0]?.id;
    if (!resolvedRunId) {
      setItems([]);
      setItemEdits({});
      setDirtyItems(new Set());
      setArtifacts([]);
      return;
    }

    void fetchRunItems(resolvedRunId);
    void fetchRunArtifacts(resolvedRunId);
  }, [selectedRunId, runs, fetchRunItems, fetchRunArtifacts]);

  const handleQuickStatus = (itemId: string, status: "passed" | "failed" | "skipped") => {
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
  };

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
            return {
              testCaseId: item.testCase.id,
              status: edit?.status ?? item.status,
              durationMs: item.durationMs,
              executedById: item.executedBy?.id ?? null,
              executedAt: item.executedAt,
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

  const handleOpenExecution = (item: RunItemRecord) => {
    if (!canManage) return;
    setExecutionItem(item);
    setExecutionModalOpen(true);
  };

  const loadRunItemArtifacts = useCallback(async (runId: string, runItemId: string) => {
    const allArtifacts: RunArtifactRecord[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(ARTIFACT_PAGE_SIZE),
        runItemId,
      });
      const response = await fetch(`/api/test-runs/${runId}/artifacts?${params.toString()}`);
      const payload = (await response.json()) as {
        items: RunArtifactRecord[];
        total: number;
        pageSize: number;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message || "Could not load run item evidence.");
      }

      allArtifacts.push(...payload.items);
      hasMore = page * payload.pageSize < payload.total;
      page += 1;
    }

    return allArtifacts;
  }, []);

  const handleSaveExecution = useCallback(
    async (payload: {
      status: ExecutionStatus;
      generalFiles: File[];
      stepFiles: Record<number, File[]>;
    }) => {
      if (!selectedRunId || !executionItem) return;

      const uploadEntries = [
        ...payload.generalFiles.map((file) => ({
          file,
          metadata: { scope: "general" as const },
        })),
        ...Object.entries(payload.stepFiles).flatMap(([stepIndex, files]) =>
          files.map((file) => ({
            file,
            metadata: { scope: "step" as const, stepIndex: Number(stepIndex) },
          })),
        ),
      ];

      for (const entry of uploadEntries) {
        const formData = new FormData();
        formData.append("file", entry.file);
        formData.append("runItemId", executionItem.id);
        formData.append("type", "screenshot");
        formData.append("metadata", JSON.stringify(entry.metadata));
        formData.append("name", entry.file.name);

        const uploadResponse = await fetch(`/api/test-runs/${selectedRunId}/artifacts/upload`, {
          method: "POST",
          body: formData,
        });
        const uploadPayload = (await uploadResponse.json()) as { message?: string };
        if (!uploadResponse.ok) {
          throw new Error(uploadPayload.message || "Could not upload evidence.");
        }
      }

      const saveResponse = await fetch(`/api/test-runs/${selectedRunId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              testCaseId: executionItem.testCase.id,
              status: payload.status,
            },
          ],
        }),
      });
      const savePayload = (await saveResponse.json()) as { message?: string };
      if (!saveResponse.ok) {
        throw new Error(savePayload.message || "Could not save execution.");
      }

      await Promise.all([
        fetchRunItems(selectedRunId),
        fetchRunArtifacts(selectedRunId),
        fetchRuns(),
      ]);
    },
    [executionItem, fetchRunArtifacts, fetchRunItems, fetchRuns, selectedRunId],
  );

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
                              <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => {
                              const edit = itemEdits[item.id] ?? { status: item.status };
                              return (
                                <tr key={item.id} className="transition-colors hover:bg-brand-50/35">
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
                                  <td className="px-3 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      {quickStatusActions.map((action) => (
                                        <Button
                                          key={action.key}
                                          size="xs"
                                          variant={edit.status === action.key ? "soft" : "quiet"}
                                          className="h-7 px-2.5"
                                          onClick={() => handleQuickStatus(item.id, action.key)}
                                          disabled={!canManage}
                                        >
                                          {action.label}
                                        </Button>
                                      ))}
                                      {canManage ? (
                                        <RowActionButton
                                          onClick={() => handleOpenExecution(item)}
                                          icon={<IconPlay className="h-4 w-4" />}
                                          label={`Execute case ${item.testCase.title}`}
                                          size="sm"
                                        />
                                      ) : null}
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
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-1">
                                  {quickStatusActions.map((action) => (
                                    <Button
                                      key={action.key}
                                      size="xs"
                                      variant={edit.status === action.key ? "soft" : "quiet"}
                                      className="h-7 px-2.5"
                                      onClick={() => handleQuickStatus(item.id, action.key)}
                                      disabled={!canManage}
                                    >
                                      {action.label}
                                    </Button>
                                  ))}
                                  {canManage ? (
                                    <RowActionButton
                                      onClick={() => handleOpenExecution(item)}
                                      icon={<IconPlay className="h-4 w-4" />}
                                      label={`Execute case ${item.testCase.title}`}
                                      size="sm"
                                    />
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {artifactsError ? (
                    <div className="rounded-lg border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-600">
                      {artifactsError}
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-stroke bg-surface p-4">
                    <div className="mb-3 text-xs font-medium text-ink-soft">
                      {loadingArtifacts ? "Updating..." : `Total: ${artifacts.length}`}
                    </div>
                    <div className="overflow-hidden rounded-lg border border-stroke">
                    <table className="w-full border-collapse text-[13px]">
                      <thead className="bg-surface-elevated dark:bg-surface-muted">
                        <tr className="text-left text-[13px] font-medium text-ink-soft">
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Size</th>
                          <th className="px-3 py-2">Created</th>
                          <th className="px-3 py-2 text-right">Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingArtifacts ? (
                          <tr>
                            <td className="px-3 py-6 text-center text-sm text-ink-muted" colSpan={5}>
                              Loading artifacts...
                            </td>
                          </tr>
                        ) : artifacts.length === 0 ? (
                          <tr>
                            <td className="px-3 py-6 text-center text-sm text-ink-muted" colSpan={5}>
                              No artifacts found.
                            </td>
                          </tr>
                        ) : (
                          artifacts.map((artifact) => (
                            <tr key={artifact.id} className="border-t border-stroke transition-colors hover:bg-brand-50/20">
                              <td className="px-3 py-3">
                                <p className="font-semibold text-ink">
                                  {artifact.name?.trim() || `Artifact ${artifact.id.slice(0, 8)}`}
                                </p>
                                <p className="text-xs text-ink-muted">{artifact.mimeType ?? "Unknown mime"}</p>
                              </td>
                              <td className="px-3 py-3 text-ink-muted">{artifact.type ?? "other"}</td>
                              <td className="px-3 py-3 text-ink-muted">{formatSize(artifact.sizeBytes)}</td>
                              <td className="px-3 py-3 text-ink-muted">{formatDate(artifact.createdAt)}</td>
                              <td className="px-3 py-3 text-right">
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
                          ))
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>

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
        />
      ) : null}

      <TestRunExecutionModal
        open={executionModalOpen}
        runId={selectedRunId}
        item={executionItem as ExecutionItemRecord | null}
        canManage={canManage}
        onClose={() => {
          setExecutionModalOpen(false);
          setExecutionItem(null);
        }}
        onLoadArtifacts={async (runId, runItemId) =>
          (await loadRunItemArtifacts(runId, runItemId)) as ExecutionArtifactRecord[]
        }
        onSave={handleSaveExecution}
      />
    </div>
  );
}
