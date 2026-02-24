"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Sheet } from "../ui/Sheet";
import { Badge } from "../ui/Badge";
import { ArtifactPreview } from "../ui/ArtifactPreview";
import { EyeIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { TestRunMetricsRecord, TestRunRecord } from "./types";

type TestRunDetailsSheetProps = {
    open: boolean;
    run: TestRunRecord | null;
    onClose: () => void;
    canManage?: boolean;
    onUpdated?: () => void;
};

type RunItemRecord = {
    id: string;
    status: "passed" | "failed" | "skipped" | "blocked" | "not_run";
    durationMs: number | null;
    executedAt: string | null;
    errorMessage: string | null;
    testCase: {
        id: string;
        title: string;
        externalKey: string | null;
    };
    executedBy: {
        id: string;
        fullName: string | null;
        email: string;
    } | null;
};

type RunArtifactRecord = {
    id: string;
    runId: string | null;
    runItemId: string | null;
    type: "screenshot" | "video" | "log" | "report" | "link" | "other";
    name: string | null;
    url: string;
    mimeType: string | null;
    checksumSha256: string | null;
    createdAt: string;
};

const itemStatusLabels: Record<RunItemRecord["status"], string> = {
    passed: "Passed",
    failed: "Failed",
    skipped: "Skipped",
    blocked: "Blocked",
    not_run: "Not Run",
};

const itemStatusTones: Record<
    RunItemRecord["status"],
    "success" | "warning" | "danger" | "neutral"
> = {
    passed: "success",
    failed: "danger",
    skipped: "neutral",
    blocked: "warning",
    not_run: "neutral",
};

function formatDate(value?: string | null) {
    if (!value) return "No date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No date";
    return date.toLocaleString();
}

function formatDuration(value?: number | null) {
    if (!value || value <= 0) return "No duration";
    if (value < 1000) return `${value} ms`;
    const seconds = Math.round(value / 1000);
    return `${seconds}s`;
}

function getRunTitle(run: TestRunRecord | null) {
    if (!run) return "Run Details";
    if (run.name?.trim()) return run.name.trim();
    return `Run ${run.id.slice(0, 6)}`;
}

export function TestRunDetailsSheet({
    open,
    run,
    onClose,
    canManage = true,
    onUpdated,
}: TestRunDetailsSheetProps) {
    const [tab, setTab] = useState<"summary" | "items" | "artifacts">("summary");
    const [metrics, setMetrics] = useState<TestRunMetricsRecord | null>(null);
    const [items, setItems] = useState<RunItemRecord[]>([]);
    const [artifacts, setArtifacts] = useState<RunArtifactRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savingItems, setSavingItems] = useState(false);
    const [savingArtifact, setSavingArtifact] = useState(false);
    const [itemEdits, setItemEdits] = useState<
        Record<
            string,
            {
                status: RunItemRecord["status"];
                durationMs: string;
                errorMessage: string;
            }
        >
    >({});
    const [dirtyItems, setDirtyItems] = useState<Set<string>>(new Set());
    const [artifactForm, setArtifactForm] = useState({
        runItemId: "",
        type: "log",
        name: "",
        url: "",
        mimeType: "",
    });
    const [artifactFile, setArtifactFile] = useState<File | null>(null);
    const [artifactMode, setArtifactMode] = useState<"url" | "file">("file");
    const [previewArtifact, setPreviewArtifact] = useState<RunArtifactRecord | null>(
        null,
    );

    // Pagination & Filtering
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalItems, setTotalItems] = useState(0);
    const [search, setSearch] = useState("");
    const [searchDebounced, setSearchDebounced] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("");

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchDebounced(search);
            setPage(1); // Reset page on search change
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const handleFilterStatusChange = (status: string) => {
        setFilterStatus(status);
        setPage(1); // Reset page on filter change
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    const canShowData = Boolean(open && run?.id);

    const dirtyItemsRef = useRef<Set<string>>(new Set());

    // Sync ref with state
    useEffect(() => {
        dirtyItemsRef.current = dirtyItems;
    }, [dirtyItems]);

    // Reset state when run changes
    useEffect(() => {
        if (!run?.id) return;
        setPage(1);
        setSearch("");
        setSearchDebounced("");
        setFilterStatus("");
        setDirtyItems(new Set());
        setItemEdits({});
        dirtyItemsRef.current = new Set();
    }, [run?.id, open]); // Include open to reset if closed/reopened

    useEffect(() => {
        if (!canShowData) return;
        let active = true;
        setLoading(true);
        setError(null);

        const runId = run?.id ?? "";

        Promise.all([
            fetch(`/api/test-runs/${runId}/metrics`, { cache: "no-store" }).then(
                (res) => res.json(),
            ),
            fetch(
                `/api/test-runs/${runId}/items?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(
                    searchDebounced,
                )}${filterStatus ? `&status=${filterStatus}` : ""}`,
                {
                    cache: "no-store",
                },
            ).then((res) => res.json()),
            fetch(`/api/test-runs/${runId}/artifacts?page=1&pageSize=50`, {
                cache: "no-store",
            }).then((res) => res.json()),
        ])
            .then(([metricsResponse, itemsResponse, artifactsResponse]) => {
                if (!active) return;
                if (metricsResponse?.message) {
                    throw new Error(metricsResponse.message);
                }
                if (itemsResponse?.message) {
                    throw new Error(itemsResponse.message);
                }
                if (artifactsResponse?.message) {
                    throw new Error(artifactsResponse.message);
                }

                const loadedItems = itemsResponse?.items ?? [];
                setMetrics(metricsResponse ?? null);
                setItems(loadedItems);
                setTotalItems(itemsResponse?.total ?? 0);
                setArtifacts(artifactsResponse?.items ?? []);

                // Merge edits, preserving dirty items
                setItemEdits((prev) => {
                    const next = { ...prev };
                    const dirty = dirtyItemsRef.current;

                    loadedItems.forEach((item: RunItemRecord) => {
                        // Only overwrite if not dirty
                        if (!dirty.has(item.id)) {
                            next[item.id] = {
                                status: item.status,
                                durationMs: item.durationMs ? String(item.durationMs) : "",
                                errorMessage: item.errorMessage ?? "",
                            };
                        }
                    });
                    return next;
                });
                // Do NOT reset dirtyItems
            })
            .catch((fetchError) => {
                if (!active) return;
                setError(
                    fetchError instanceof Error
                        ? fetchError.message
                        : "Could not load run details.",
                );
            })
            .finally(() => {
                if (!active) return;
                setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [canShowData, run?.id, page, pageSize, searchDebounced, filterStatus]);

    useEffect(() => {
        if (!open) setTab("summary");
    }, [open]);

    const metricsSummary = useMemo(() => {
        if (!metrics) return null;
        return [
            { label: "Total", value: metrics.total },
            { label: "Passed", value: metrics.passed },
            { label: "Failed", value: metrics.failed },
            { label: "Blocked", value: metrics.blocked },
            { label: "Skipped", value: metrics.skipped },
            { label: "Not Run", value: metrics.notRun },
        ];
    }, [metrics]);

    const handleItemChange = (
        itemId: string,
        field: "status" | "durationMs" | "errorMessage",
        value: string,
    ) => {
        setItemEdits((prev) => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value,
            },
        }));
        setDirtyItems((prev) => {
            const next = new Set(prev);
            next.add(itemId);
            return next;
        });
    };

    const reloadData = async () => {
        if (!run?.id) return;
        setLoading(true);
        setError(null);
        try {
            const [metricsResponse, itemsResponse, artifactsResponse] =
                await Promise.all([
                    fetch(`/api/test-runs/${run.id}/metrics`, { cache: "no-store" }).then(
                        (res) => res.json(),
                    ),
                    fetch(
                        `/api/test-runs/${run.id}/items?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(
                            searchDebounced,
                        )}${filterStatus ? `&status=${filterStatus}` : ""}`,
                        {
                            cache: "no-store",
                        },
                    ).then((res) => res.json()),
                    fetch(`/api/test-runs/${run.id}/artifacts?page=1&pageSize=50`, {
                        cache: "no-store",
                    }).then((res) => res.json()),
                ]);
            if (metricsResponse?.message) throw new Error(metricsResponse.message);
            if (itemsResponse?.message) throw new Error(itemsResponse.message);
            if (artifactsResponse?.message) throw new Error(artifactsResponse.message);

            const loadedItems = itemsResponse?.items ?? [];
            setMetrics(metricsResponse ?? null);
            setItems(loadedItems);
            setTotalItems(itemsResponse?.total ?? 0);
            setArtifacts(artifactsResponse?.items ?? []);
            setItemEdits(
                Object.fromEntries(
                    loadedItems.map((item: RunItemRecord) => [
                        item.id,
                        {
                            status: item.status,
                            durationMs: item.durationMs ? String(item.durationMs) : "",
                            errorMessage: item.errorMessage ?? "",
                        },
                    ]),
                ),
            );
            setDirtyItems(new Set());
        } catch (fetchError) {
            setError(
                fetchError instanceof Error
                    ? fetchError.message
                    : "Could not refresh run details.",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSaveItems = async () => {
        if (!run?.id) return;
        if (dirtyItems.size === 0) return;
        setSavingItems(true);
        setError(null);
        try {
            const payload = {
                items: items
                    .filter((item) => dirtyItems.has(item.id))
                    .map((item) => {
                        const edit = itemEdits[item.id];
                        return {
                            testCaseId: item.testCase.id,
                            status: edit?.status ?? item.status,
                            durationMs: edit?.durationMs ? Number(edit.durationMs) : null,
                            errorMessage: edit?.errorMessage?.trim() || null,
                        };
                    }),
            };

            const response = await fetch(`/api/test-runs/${run.id}/items`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = (await response.json()) as { message?: string };
            if (!response.ok) {
                throw new Error(data.message || "Could not save items.");
            }

            await reloadData();
            onUpdated?.();
        } catch (saveError) {
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : "Could not save items.",
            );
        } finally {
            setSavingItems(false);
        }
    };

    const handleCreateArtifact = async () => {
        if (!run?.id) return;
        setSavingArtifact(true);
        setError(null);
        try {
            let response: Response;
            if (artifactMode === "file") {
                if (!artifactFile) {
                    setError("Select a file to upload.");
                    setSavingArtifact(false);
                    return;
                }
                const formData = new FormData();
                formData.append("file", artifactFile);
                formData.append("runItemId", artifactForm.runItemId || "");
                formData.append("type", artifactForm.type);
                formData.append("name", artifactForm.name || "");
                response = await fetch(`/api/test-runs/${run.id}/artifacts/upload`, {
                    method: "POST",
                    body: formData,
                });
            } else {
                if (!artifactForm.url.trim()) {
                    setError("Artifact URL is required.");
                    setSavingArtifact(false);
                    return;
                }
                response = await fetch(`/api/test-runs/${run.id}/artifacts`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        artifacts: [
                            {
                                runItemId: artifactForm.runItemId || null,
                                type: artifactForm.type,
                                name: artifactForm.name || null,
                                url: artifactForm.url,
                                mimeType: artifactForm.mimeType || null,
                            },
                        ],
                    }),
                });
            }

            const data = (await response.json()) as { message?: string };
            if (!response.ok) {
                throw new Error(data.message || "Could not create artifact.");
            }

            setArtifactForm({
                runItemId: "",
                type: "log",
                name: "",
                url: "",
                mimeType: "",
            });
            setArtifactFile(null);
            setArtifactMode("file");
            await reloadData();
            onUpdated?.();
        } catch (saveError) {
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : "Could not create artifact.",
            );
        } finally {
            setSavingArtifact(false);
        }
    };

    const handleDeleteArtifact = async (artifactId: string) => {
        if (!run?.id) return;
        if (!window.confirm("Are you sure you want to delete this artifact?")) return;

        setLoading(true); // Or use a specific loading state
        try {
            const response = await fetch(`/api/test-runs/${run.id}/artifacts/${artifactId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || "Failed to delete artifact.");
            }

            await reloadData();
            onUpdated?.();
        } catch (error) {
            setError(
                error instanceof Error ? error.message : "Failed to delete artifact."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title={getRunTitle(run)}
            description="Run summary, results, and associated artifacts."
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-soft">
                        <button
                            type="button"
                            onClick={() => setTab("summary")}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === "summary"
                                ? "bg-brand-50 text-brand-700"
                                : "border border-stroke text-ink-muted"
                                }`}
                        >
                            Summary
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab("items")}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === "items"
                                ? "bg-brand-50 text-brand-700"
                                : "border border-stroke text-ink-muted"
                                }`}
                        >
                            Items
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab("artifacts")}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === "artifacts"
                                ? "bg-brand-50 text-brand-700"
                                : "border border-stroke text-ink-muted"
                                }`}
                        >
                            Artifacts
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => run?.id && window.open(`/api/test-runs/${run.id}/export?format=pdf`, "_blank")}
                            className="rounded-full border border-stroke px-3 py-1 text-xs font-semibold text-ink-muted hover:bg-brand-50 hover:text-ink"
                            title="Export as PDF"
                        >
                            PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => run?.id && window.open(`/api/test-runs/${run.id}/export?format=html`, "_blank")}
                            className="rounded-full border border-stroke px-3 py-1 text-xs font-semibold text-ink-muted hover:bg-brand-50 hover:text-ink"
                            title="Export as HTML"
                        >
                            HTML
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="rounded-lg border border-stroke bg-surface-muted/40 px-4 py-6 text-sm text-ink-muted">
                        Loading run details...
                    </div>
                ) : null}

                {error ? (
                    <div className="rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
                        {error}
                    </div>
                ) : null}

                {!loading && !error && tab === "summary" ? (
                    <div className="space-y-4">
                        <div className="grid gap-3 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted p-4 text-sm text-ink-muted md:grid-cols-2">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                    Project
                                </p>
                                <p className="mt-1 text-sm font-semibold text-ink">
                                    {run?.project.key} · {run?.project.name}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                    Plan / Suite
                                </p>
                                <p className="mt-1 text-sm font-semibold text-ink">
                                    {run?.testPlan?.name ?? run?.suite?.testPlan.name ?? "No plan"}
                                </p>
                                <p className="text-xs text-ink-muted">
                                    {run?.suite?.name ?? "No suite"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                    Environment
                                </p>
                                <p className="mt-1 text-sm font-semibold text-ink">
                                    {run?.environment ?? "No environment"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                    Build / Commit
                                </p>
                                <p className="mt-1 text-sm font-semibold text-ink">
                                    {run?.buildNumber ?? "No build"}
                                </p>
                                <p className="text-xs text-ink-muted">
                                    {run?.commitSha ? run.commitSha.slice(0, 10) : "No commit"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                    Start
                                </p>
                                <p className="mt-1 text-sm font-semibold text-ink">
                                    {formatDate(run?.startedAt)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                    End
                                </p>
                                <p className="mt-1 text-sm font-semibold text-ink">
                                    {formatDate(run?.finishedAt)}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                        Metrics
                                    </p>
                                    <p className="mt-1 text-sm text-ink-muted">
                                        {metrics?.passRate
                                            ? `Pass rate: ${metrics.passRate}%`
                                            : "No metrics"}
                                    </p>
                                </div>
                                <Badge tone="success">
                                    {metrics?.passRate ? `${metrics.passRate}%` : "--"}
                                </Badge>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-ink-muted md:grid-cols-3">
                                {metricsSummary?.map((item) => (
                                    <div key={item.label} className="rounded-md bg-surface-muted/40 p-3">
                                        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                            {item.label}
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-ink">
                                            {item.value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : null}

                {!loading && !error && tab === "items" ? (
                    <div className="space-y-3">
                        {items.length === 0 && !search && !filterStatus ? (
                            <div className="rounded-lg border border-dashed border-stroke px-4 py-6 text-sm text-ink-muted">
                                There are no items for this run pending creation or synchronization.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {canManage ? (
                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stroke bg-surface-muted/40 px-4 py-3 text-xs text-ink-muted">
                                        <span>
                                            {dirtyItems.size > 0
                                                ? `${dirtyItems.size} pending changes`
                                                : "No pending changes"}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleSaveItems}
                                            disabled={savingItems || dirtyItems.size === 0}
                                            className="rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-brand-200"
                                        >
                                            {savingItems ? "Saving..." : "Save changes"}
                                        </button>
                                    </div>
                                ) : null}


                                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted p-3">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            placeholder="Search test cases..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            className="w-full rounded-md border border-stroke px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <select
                                            value={filterStatus}
                                            onChange={(e) => handleFilterStatusChange(e.target.value)}
                                            className="w-full rounded-md border border-stroke px-3 py-1.5 text-sm text-ink focus:border-brand-500 focus:outline-none"
                                        >
                                            <option value="">All statuses</option>
                                            {Object.entries(itemStatusLabels).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {items.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-stroke px-4 py-6 text-center text-sm text-ink-muted">
                                        No items found matching current filters.
                                    </div>
                                ) : (
                                    items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted p-4"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-ink">
                                                        {item.testCase.externalKey
                                                            ? `${item.testCase.externalKey} · ${item.testCase.title}`
                                                            : item.testCase.title}
                                                    </p>
                                                    <p className="text-xs text-ink-muted">
                                                        Executed by{" "}
                                                        {item.executedBy?.fullName ??
                                                            item.executedBy?.email ??
                                                            "No executor"}
                                                    </p>
                                                </div>
                                                {canManage ? (
                                                    <select
                                                        value={itemEdits[item.id]?.status ?? item.status}
                                                        onChange={(event) =>
                                                            handleItemChange(
                                                                item.id,
                                                                "status",
                                                                event.target.value,
                                                            )
                                                        }
                                                        className="rounded-full border border-stroke px-3 py-1 text-xs font-semibold text-ink"
                                                    >
                                                        {Object.entries(itemStatusLabels).map(
                                                            ([value, label]) => (
                                                                <option key={value} value={value}>
                                                                    {label}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                ) : (
                                                    <Badge tone={itemStatusTones[item.status]}>
                                                        {itemStatusLabels[item.status]}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="mt-3 text-xs text-ink-muted">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <p>Duration: {formatDuration(item.durationMs)}</p>
                                                    <p>Date: {formatDate(item.executedAt)}</p>
                                                </div>
                                                {canManage ? (
                                                    <div className="mt-3 grid gap-3 text-xs text-ink-muted md:grid-cols-2">
                                                        <label className="space-y-1">
                                                            <span className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                                                Duration (ms)
                                                            </span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={itemEdits[item.id]?.durationMs ?? ""}
                                                                onChange={(event) =>
                                                                    handleItemChange(
                                                                        item.id,
                                                                        "durationMs",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                                className="w-full rounded-lg border border-stroke px-3 py-2 text-sm text-ink"
                                                            />
                                                        </label>
                                                        <label className="space-y-1">
                                                            <span className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                                                Error
                                                            </span>
                                                            <input
                                                                type="text"
                                                                value={itemEdits[item.id]?.errorMessage ?? ""}
                                                                onChange={(event) =>
                                                                    handleItemChange(
                                                                        item.id,
                                                                        "errorMessage",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                                className="w-full rounded-lg border border-stroke px-3 py-2 text-sm text-ink"
                                                            />
                                                        </label>
                                                    </div>
                                                ) : item.errorMessage ? (
                                                    <p className="mt-2 text-danger-500">
                                                        {item.errorMessage}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))
                                )}

                                {/* Pagination Controls */}
                                {totalItems > pageSize && (
                                    <div className="flex items-center justify-between border-t border-stroke pt-4">
                                        <div className="text-xs text-ink-muted">
                                            Showing {(page - 1) * pageSize + 1} to{" "}
                                            {Math.min(page * pageSize, totalItems)} of {totalItems}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handlePageChange(page - 1)}
                                                disabled={page === 1}
                                                className="rounded-md border border-stroke px-3 py-1 text-xs font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handlePageChange(page + 1)}
                                                disabled={page * pageSize >= totalItems}
                                                className="rounded-md border border-stroke px-3 py-1 text-xs font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : null}

                {!loading && !error && tab === "artifacts" ? (
                    <div className="space-y-3">
                        {canManage ? (
                            <div className="rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                    New Artifact
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setArtifactMode("file");
                                            setArtifactForm((prev) => ({ ...prev, url: "" }));
                                        }}
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${artifactMode === "file"
                                            ? "bg-brand-50 text-brand-700"
                                            : "border border-stroke text-ink-muted"
                                            }`}
                                    >
                                        Upload file
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setArtifactMode("url");
                                            setArtifactFile(null);
                                        }}
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${artifactMode === "url"
                                            ? "bg-brand-50 text-brand-700"
                                            : "border border-stroke text-ink-muted"
                                            }`}
                                    >
                                        Use URL
                                    </button>
                                </div>
                                <div className="mt-3 grid gap-3 text-sm text-ink md:grid-cols-2">
                                    <label className="space-y-1">
                                        <span className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                            Item (optional)
                                        </span>
                                        <select
                                            value={artifactForm.runItemId}
                                            onChange={(event) =>
                                                setArtifactForm((prev) => ({
                                                    ...prev,
                                                    runItemId: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-stroke px-3 py-2 text-sm text-ink"
                                        >
                                            <option value="">Full Run</option>
                                            {items.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.testCase.externalKey
                                                        ? `${item.testCase.externalKey} · ${item.testCase.title}`
                                                        : item.testCase.title}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                            Type
                                        </span>
                                        <select
                                            value={artifactForm.type}
                                            onChange={(event) =>
                                                setArtifactForm((prev) => ({
                                                    ...prev,
                                                    type: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-stroke px-3 py-2 text-sm text-ink"
                                        >
                                            {[
                                                "screenshot",
                                                "video",
                                                "log",
                                                "report",
                                                "link",
                                                "other",
                                            ].map((type) => (
                                                <option key={type} value={type}>
                                                    {type.toUpperCase()}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="space-y-1 md:col-span-2">
                                        <span className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                            URL
                                        </span>
                                        <input
                                            type="text"
                                            value={artifactForm.url}
                                            disabled={artifactMode === "file"}
                                            onChange={(event) =>
                                                setArtifactForm((prev) => ({
                                                    ...prev,
                                                    url: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-stroke px-3 py-2 text-sm text-ink"
                                            placeholder="https://..."
                                        />
                                    </label>
                                    <label className="space-y-1 md:col-span-2">
                                        <span className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                            File
                                        </span>
                                        <input
                                            key={artifactFile ? artifactFile.name : "empty"}
                                            type="file"
                                            disabled={artifactMode === "url"}
                                            onChange={(event) =>
                                                setArtifactFile(event.target.files?.[0] ?? null)
                                            }
                                            className="w-full rounded-lg border border-stroke px-3 py-2 text-sm text-ink"
                                        />
                                        {artifactFile ? (
                                            <p className="text-xs text-ink-muted">
                                                {artifactFile.name} · {Math.round(artifactFile.size / 1024)} KB
                                            </p>
                                        ) : null}
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                            Name
                                        </span>
                                        <input
                                            type="text"
                                            value={artifactForm.name}
                                            onChange={(event) =>
                                                setArtifactForm((prev) => ({
                                                    ...prev,
                                                    name: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-stroke px-3 py-2 text-sm text-ink"
                                        />
                                    </label>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleCreateArtifact}
                                        disabled={savingArtifact}
                                        className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-brand-200"
                                    >
                                        {savingArtifact ? "Uploading..." : "Upload artifact"}
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {artifacts.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-stroke px-4 py-6 text-sm text-ink-muted">
                                No artifacts found.
                            </div>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {artifacts.map((artifact) => (
                                    <div
                                        key={artifact.id}
                                        className="flex flex-col justify-between rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted p-4"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2">
                                                <Badge>{artifact.type}</Badge>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewArtifact(artifact)}
                                                        className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
                                                        title="View artifact"
                                                    >
                                                        <EyeIcon className="h-4 w-4" />
                                                        View
                                                    </button>
                                                    <a
                                                        href={artifact.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-ink-muted hover:underline"
                                                    >
                                                        Download
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteArtifact(artifact.id)}
                                                        className="text-xs text-danger-500 hover:text-danger-600 hover:underline"
                                                        title="Delete artifact"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="mt-2 text-sm font-semibold text-ink">
                                                {artifact.name || "No name"}
                                            </p>
                                            <p className="text-xs text-ink-muted">
                                                {formatDate(artifact.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            <ArtifactPreview
                open={Boolean(previewArtifact)}
                onClose={() => setPreviewArtifact(null)}
                artifact={previewArtifact}
            />
        </Sheet >
    );
}
