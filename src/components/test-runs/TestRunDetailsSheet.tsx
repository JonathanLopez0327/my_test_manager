"use client";

import { useEffect, useMemo, useState, useRef, type DragEvent } from "react";
import { Sheet } from "../ui/Sheet";
import { Badge } from "../ui/Badge";
import { ArtifactPreview } from "../ui/ArtifactPreview";
import { SearchInput } from "../ui/SearchInput";
import { Button } from "../ui/Button";
import { cn } from "@/lib/utils";
import {
    ArrowDownTrayIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ClipboardDocumentIcon,
    DocumentIcon,
    DocumentTextIcon,
    EyeIcon,
    FilmIcon,
    LinkIcon,
    PhotoIcon,
    PlusIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";
import type { TestRunMetricsRecord, TestRunRecord } from "./types";
import { AssistantHubTrigger } from "@/components/assistant-hub/AssistantHubTrigger";

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
    type: string | null;
    name: string | null;
    url: string;
    mimeType: string | null;
    checksumSha256: string | null;
    createdAt: string;
    sizeBytes?: number | string | null;
};

type ItemFilter = "all" | RunItemRecord["status"];
type ArtifactType = "screenshot" | "video" | "log" | "report" | "link" | "other";
type ArtifactGroup = "reports" | "logs" | "screenshots" | "videos" | "other";
type DisplayArtifactRecord = RunArtifactRecord & {
    resolvedType: ArtifactType;
    previewable: boolean;
    isHtml: boolean;
};
type PreviewArtifactRecord = {
    url: string;
    type: string;
    mimeType?: string | null;
    name?: string | null;
};

const ITEM_FETCH_PAGE_SIZE = 100;
const ARTIFACT_FETCH_PAGE_SIZE = 100;

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

const itemFilterLabels: Record<ItemFilter, string> = {
    all: "All",
    passed: "Passed",
    failed: "Failed",
    skipped: "Skipped",
    blocked: "Blocked",
    not_run: "Not run",
};

const artifactTypeLabels: Record<ArtifactType, string> = {
    report: "Report",
    log: "Log",
    screenshot: "Screenshot",
    video: "Video",
    link: "Link",
    other: "File",
};

const artifactGroupLabel: Record<ArtifactGroup, string> = {
    reports: "Reports",
    logs: "Logs",
    screenshots: "Screenshots",
    videos: "Videos",
    other: "Other",
};

const artifactGroupByType: Record<ArtifactType, ArtifactGroup> = {
    report: "reports",
    log: "logs",
    screenshot: "screenshots",
    video: "videos",
    link: "other",
    other: "other",
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

function splitTestTitle(title: string, externalKey?: string | null) {
    const normalizedTitle = title.trim();
    const withCode = normalizedTitle.match(
        /^([A-Za-z]{1,6}[-_ ]?\d+)\s*[-:]\s*\[([^\]]+)\]\s*[-:]\s*(.+)$/,
    );
    if (withCode) {
        const [, code, suite, primary] = withCode;
        return {
            primary,
            secondary: `${externalKey || code.replace(/\s+/g, "-").toUpperCase()} · [${suite}]`,
        };
    }

    const withSuite = normalizedTitle.match(/^TC\s*[-:]\s*\[([^\]]+)\]\s*[-:]\s*(.+)$/i);
    if (withSuite) {
        const [, suite, primary] = withSuite;
        return {
            primary,
            secondary: `${externalKey || "TC"} · [${suite}]`,
        };
    }

    return {
        primary: normalizedTitle,
        secondary: externalKey || null,
    };
}

function getArtifactExtension(name?: string | null, url?: string | null) {
    const source = name?.trim() || url?.split("?")[0] || "";
    const match = source.toLowerCase().match(/\.([a-z0-9]{2,8})$/);
    return match?.[1] ?? "";
}

function resolveArtifactType(artifact: RunArtifactRecord): ArtifactType {
    const explicit = String(artifact.type ?? "").toLowerCase().trim();
    if (explicit === "screenshot" || explicit === "image") return "screenshot";
    if (explicit === "video") return "video";
    if (explicit === "log") return "log";
    if (explicit === "report" || explicit === "html") return "report";
    if (explicit === "link" || explicit === "url") return "link";
    if (explicit === "other" || explicit === "file") return "other";

    const mimeType = String(artifact.mimeType ?? "").toLowerCase();
    const extension = getArtifactExtension(artifact.name, artifact.url);
    if (
        mimeType.startsWith("image/") ||
        ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(extension)
    ) {
        return "screenshot";
    }
    if (
        mimeType.startsWith("video/") ||
        ["mp4", "mov", "webm", "avi", "mkv"].includes(extension)
    ) {
        return "video";
    }
    if (
        mimeType.includes("html") ||
        ["html", "htm"].includes(extension)
    ) {
        return "report";
    }
    if (
        mimeType.startsWith("text/") ||
        mimeType.includes("json") ||
        ["txt", "log", "json", "xml", "csv", "md", "yaml", "yml"].includes(extension)
    ) {
        return "log";
    }
    if (/^https?:\/\//i.test(artifact.url) && !extension) return "link";
    return "other";
}

function isHtmlArtifact(artifact: RunArtifactRecord, resolvedType: ArtifactType) {
    const mimeType = String(artifact.mimeType ?? "").toLowerCase();
    const extension = getArtifactExtension(artifact.name, artifact.url);
    return (
        resolvedType === "report" ||
        mimeType.includes("html") ||
        ["html", "htm"].includes(extension)
    );
}

function isPreviewableArtifact(artifact: RunArtifactRecord, resolvedType: ArtifactType) {
    if (isHtmlArtifact(artifact, resolvedType)) return true;
    const mimeType = String(artifact.mimeType ?? "").toLowerCase();
    const extension = getArtifactExtension(artifact.name, artifact.url);
    if (resolvedType === "screenshot" || resolvedType === "video" || resolvedType === "log") {
        return true;
    }
    return (
        mimeType.startsWith("image/") ||
        mimeType.startsWith("video/") ||
        mimeType.startsWith("text/") ||
        mimeType.includes("json") ||
        mimeType === "application/pdf" ||
        ["png", "jpg", "jpeg", "gif", "webp", "svg", "txt", "log", "json", "xml", "csv", "md", "yaml", "yml", "pdf", "mp4", "webm", "mov"].includes(
            extension,
        )
    );
}

function getArtifactIcon(type: ArtifactType) {
    if (type === "screenshot") return <PhotoIcon className="h-4 w-4" />;
    if (type === "video") return <FilmIcon className="h-4 w-4" />;
    if (type === "log" || type === "report")
        return <DocumentTextIcon className="h-4 w-4" />;
    if (type === "link") return <LinkIcon className="h-4 w-4" />;
    return <DocumentIcon className="h-4 w-4" />;
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
    const [previewArtifact, setPreviewArtifact] = useState<PreviewArtifactRecord | null>(
        null,
    );
    const [itemFilter, setItemFilter] = useState<ItemFilter>("all");
    const [failuresFirst, setFailuresFirst] = useState(false);
    const [showFailedOnly, setShowFailedOnly] = useState(false);
    const [lastItemFilterBeforeFailedOnly, setLastItemFilterBeforeFailedOnly] =
        useState<ItemFilter>("all");
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [itemSearch, setItemSearch] = useState("");
    const [showArtifactForm, setShowArtifactForm] = useState(false);
    const [isArtifactDropActive, setIsArtifactDropActive] = useState(false);
    const [artifactFieldErrors, setArtifactFieldErrors] = useState<{
        file?: string;
        url?: string;
        type?: string;
    }>({});

    const [totalItems, setTotalItems] = useState(0);

    const canShowData = Boolean(open && run?.id);

    const dirtyItemsRef = useRef<Set<string>>(new Set());

    // Sync ref with state
    useEffect(() => {
        dirtyItemsRef.current = dirtyItems;
    }, [dirtyItems]);

    // Reset state when run changes
    useEffect(() => {
        if (!run?.id) return;
        setItemSearch("");
        setItemFilter("all");
        setFailuresFirst(false);
        setShowFailedOnly(false);
        setLastItemFilterBeforeFailedOnly("all");
        setExpandedItems(new Set());
        setShowArtifactForm(false);
        setDirtyItems(new Set());
        setItemEdits({});
        setArtifactFieldErrors({});
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
                `/api/test-runs/${runId}/items?page=1&pageSize=${ITEM_FETCH_PAGE_SIZE}`,
                {
                    cache: "no-store",
                },
            ).then((res) => res.json()),
            fetch(
                `/api/test-runs/${runId}/artifacts?page=1&pageSize=${ARTIFACT_FETCH_PAGE_SIZE}`,
                {
                cache: "no-store",
                },
            ).then((res) => res.json()),
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
    }, [canShowData, run?.id]);

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

    const computedCounts = useMemo(() => {
        const base = {
            total: items.length,
            passed: 0,
            failed: 0,
            skipped: 0,
            blocked: 0,
            not_run: 0,
        };
        items.forEach((item) => {
            const effectiveStatus = itemEdits[item.id]?.status ?? item.status;
            base[effectiveStatus] += 1;
        });
        return base;
    }, [items, itemEdits]);

    const statusCounts = useMemo(() => {
        if (metrics) {
            return {
                total: metrics.total,
                passed: metrics.passed,
                failed: metrics.failed,
                skipped: metrics.skipped,
                blocked: metrics.blocked,
                not_run: metrics.notRun,
            };
        }
        return computedCounts;
    }, [metrics, computedCounts]);

    const filterCounts: Record<ItemFilter, number> = {
        all: statusCounts.total,
        passed: statusCounts.passed,
        failed: statusCounts.failed,
        skipped: statusCounts.skipped,
        blocked: statusCounts.blocked,
        not_run: statusCounts.not_run,
    };

    const effectiveItemFilter = showFailedOnly ? "failed" : itemFilter;

    const visibleItems = useMemo(() => {
        const normalizedSearch = itemSearch.trim().toLowerCase();
        const filtered = items.filter((item) => {
            const effectiveStatus = itemEdits[item.id]?.status ?? item.status;
            if (effectiveItemFilter !== "all" && effectiveStatus !== effectiveItemFilter) {
                return false;
            }
            if (!normalizedSearch) return true;

            const formatted = splitTestTitle(item.testCase.title, item.testCase.externalKey);
            const haystack = [
                item.testCase.title,
                formatted.primary,
                formatted.secondary,
                item.testCase.externalKey,
                item.executedBy?.fullName,
                item.executedBy?.email,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(normalizedSearch);
        });

        if (!failuresFirst) return filtered;
        return [...filtered].sort((a, b) => {
            const statusA = itemEdits[a.id]?.status ?? a.status;
            const statusB = itemEdits[b.id]?.status ?? b.status;
            if (statusA === statusB) return 0;
            if (statusA === "failed") return -1;
            if (statusB === "failed") return 1;
            return 0;
        });
    }, [items, itemSearch, effectiveItemFilter, itemEdits, failuresFirst]);

    const failedVisibleItems = useMemo(
        () =>
            visibleItems.filter((item) => {
                const effectiveStatus = itemEdits[item.id]?.status ?? item.status;
                return effectiveStatus === "failed";
            }),
        [visibleItems, itemEdits],
    );

    const normalizedArtifacts = useMemo<DisplayArtifactRecord[]>(() => {
        return artifacts.map((artifact) => {
            const resolvedType = resolveArtifactType(artifact);
            return {
                ...artifact,
                resolvedType,
                previewable: isPreviewableArtifact(artifact, resolvedType),
                isHtml: isHtmlArtifact(artifact, resolvedType),
            };
        });
    }, [artifacts]);

    const groupedArtifacts = useMemo(() => {
        if (normalizedArtifacts.length < 6) {
            return [
                {
                    key: "other" as ArtifactGroup,
                    title: "Artifacts",
                    items: normalizedArtifacts,
                },
            ];
        }

        const buckets: Record<ArtifactGroup, DisplayArtifactRecord[]> = {
            reports: [],
            logs: [],
            screenshots: [],
            videos: [],
            other: [],
        };
        normalizedArtifacts.forEach((artifact) => {
            const key = artifactGroupByType[artifact.resolvedType] ?? "other";
            buckets[key].push(artifact);
        });

        return (Object.keys(buckets) as ArtifactGroup[])
            .map((key) => ({
                key,
                title: artifactGroupLabel[key],
                items: buckets[key],
            }))
            .filter((group) => group.items.length > 0);
    }, [normalizedArtifacts]);

    const summaryEvidence = useMemo(() => {
        const priorityOrder: Record<ArtifactType, number> = {
            report: 0,
            screenshot: 1,
            log: 2,
            video: 3,
            other: 4,
            link: 5,
        };
        return [...normalizedArtifacts]
            .sort((a, b) => {
                const typeDiff = priorityOrder[a.resolvedType] - priorityOrder[b.resolvedType];
                if (typeDiff !== 0) return typeDiff;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            })
            .slice(0, 3);
    }, [normalizedArtifacts]);

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

    const toggleExpandedItem = (itemId: string) => {
        setExpandedItems((prev) => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };

    const handleItemFilterChange = (nextFilter: ItemFilter) => {
        setItemFilter(nextFilter);
        if (showFailedOnly && nextFilter !== "failed") {
            setShowFailedOnly(false);
        }
    };

    const handleToggleShowFailedOnly = () => {
        if (showFailedOnly) {
            setShowFailedOnly(false);
            if (itemFilter === "failed" && lastItemFilterBeforeFailedOnly !== "failed") {
                setItemFilter(lastItemFilterBeforeFailedOnly);
            }
            return;
        }
        setLastItemFilterBeforeFailedOnly(itemFilter);
        setItemFilter("failed");
        setShowFailedOnly(true);
    };

    const handleExpandFailedItems = () => {
        if (failedVisibleItems.length === 0) return;
        setExpandedItems((prev) => {
            const next = new Set(prev);
            failedVisibleItems.forEach((item) => {
                next.add(item.id);
            });
            return next;
        });
    };

    const handlePreviewArtifact = (artifact: DisplayArtifactRecord) => {
        if (artifact.isHtml) {
            window.open(artifact.url, "_blank", "noopener,noreferrer");
            return;
        }
        if (artifact.previewable) {
            setPreviewArtifact({
                url: artifact.url,
                type: artifact.resolvedType,
                mimeType: artifact.mimeType,
                name: artifact.name,
            });
        }
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
                        `/api/test-runs/${run.id}/items?page=1&pageSize=${ITEM_FETCH_PAGE_SIZE}`,
                        {
                            cache: "no-store",
                        },
                    ).then((res) => res.json()),
                    fetch(
                        `/api/test-runs/${run.id}/artifacts?page=1&pageSize=${ARTIFACT_FETCH_PAGE_SIZE}`,
                        {
                        cache: "no-store",
                        },
                    ).then((res) => res.json()),
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

    const validateArtifactForm = () => {
        const nextErrors: { file?: string; url?: string; type?: string } = {};
        if (!artifactForm.type.trim()) nextErrors.type = "Type is required.";

        if (artifactMode === "file" && !artifactFile) {
            nextErrors.file = "Select a file or drop one here.";
        }

        if (artifactMode === "url") {
            const trimmed = artifactForm.url.trim();
            if (!trimmed) {
                nextErrors.url = "Artifact URL is required.";
            } else {
                try {
                    new URL(trimmed);
                } catch {
                    nextErrors.url = "Enter a valid URL.";
                }
            }
        }
        setArtifactFieldErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleCreateArtifact = async () => {
        if (!run?.id) return;
        if (!validateArtifactForm()) return;
        setSavingArtifact(true);
        setError(null);
        try {
            let response: Response;
            if (artifactMode === "file") {
                const formData = new FormData();
                formData.append("file", artifactFile as File);
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
            setArtifactFieldErrors({});
            setShowArtifactForm(false);
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

    const handleCopyArtifactUrl = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            setError("Could not copy artifact link.");
        }
    };

    const handleArtifactDrop = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsArtifactDropActive(false);
        if (artifactMode !== "file") return;
        const droppedFile = event.dataTransfer.files?.[0] ?? null;
        setArtifactFile(droppedFile);
        setArtifactFieldErrors((prev) => ({ ...prev, file: undefined }));
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
                        {run ? (
                            <AssistantHubTrigger
                                context={{ type: "testRun", testRunId: run.id, testRunTitle: run.name ?? `Run #${run.id.slice(0, 8)}`, projectId: run.projectId }}
                                label="Ask AI"
                                variant="button"
                            />
                        ) : null}
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

                        <div className="rounded-lg border border-stroke bg-surface-elevated p-4 dark:bg-surface-muted">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                        Evidence
                                    </p>
                                    <p className="mt-1 text-sm text-ink-muted">
                                        {normalizedArtifacts.length > 0
                                            ? `${normalizedArtifacts.length} artifact${normalizedArtifacts.length === 1 ? "" : "s"} attached to this run`
                                            : "No evidence yet"}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="rounded-full"
                                    onClick={() => setTab("artifacts")}
                                >
                                    View all artifacts
                                </Button>
                            </div>

                            {summaryEvidence.length === 0 ? (
                                <div className="mt-4 rounded-md border border-dashed border-stroke px-3 py-4 text-sm text-ink-muted">
                                    No evidence yet.
                                    {canManage ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTab("artifacts");
                                                setShowArtifactForm(true);
                                            }}
                                            className="ml-2 font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                                        >
                                            Upload artifact
                                        </button>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="mt-4 space-y-2">
                                    {summaryEvidence.map((artifact) => (
                                        <article
                                            key={artifact.id}
                                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stroke bg-surface-muted/30 px-3 py-2"
                                        >
                                            <div className="min-w-0">
                                                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                                                    <span className="text-ink-muted">
                                                        {getArtifactIcon(artifact.resolvedType)}
                                                    </span>
                                                    <span className="truncate">
                                                        {artifact.name || "Unnamed artifact"}
                                                    </span>
                                                </p>
                                                <p className="text-xs text-ink-muted">
                                                    {artifactTypeLabels[artifact.resolvedType]} ·{" "}
                                                    {formatDate(artifact.createdAt)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                {artifact.previewable ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePreviewArtifact(artifact)}
                                                        className="rounded-full border border-stroke px-2.5 py-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                                                    >
                                                        {artifact.isHtml ? "Open" : "Preview"}
                                                    </button>
                                                ) : null}
                                                <a
                                                    href={artifact.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="rounded-full border border-stroke px-2.5 py-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                                                >
                                                    {artifact.resolvedType === "link" ? "Open" : "Download"}
                                                </a>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}

                {!loading && !error && tab === "items" ? (
                    <div className="space-y-3">
                        {canManage ? (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stroke bg-surface-muted/40 px-4 py-3 text-xs text-ink-muted">
                                <span>
                                    {dirtyItems.size > 0
                                        ? `${dirtyItems.size} pending changes`
                                        : "No pending changes"}
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleSaveItems}
                                    disabled={savingItems || dirtyItems.size === 0}
                                    className="rounded-full"
                                >
                                    {savingItems ? "Saving..." : "Save changes"}
                                </Button>
                            </div>
                        ) : null}

                        <div className="sticky top-0 z-20 rounded-lg border border-stroke bg-surface-elevated/95 p-3 shadow-sm backdrop-blur dark:bg-surface-muted/95">
                            <p className="text-xs font-medium text-ink-muted">
                                {statusCounts.total} total • {statusCounts.failed} failed •{" "}
                                {statusCounts.passed} passed
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                {(Object.keys(itemFilterLabels) as ItemFilter[]).map((filterKey) => {
                                    const isActive = effectiveItemFilter === filterKey;
                                    return (
                                        <button
                                            key={filterKey}
                                            type="button"
                                            onClick={() => handleItemFilterChange(filterKey)}
                                            aria-pressed={isActive}
                                            className={cn(
                                                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                                                isActive
                                                    ? "border-brand-300 bg-brand-50 text-brand-700"
                                                    : "border-stroke text-ink-muted hover:bg-surface-muted",
                                            )}
                                        >
                                            {itemFilterLabels[filterKey]} ({filterCounts[filterKey] ?? 0})
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    aria-pressed={failuresFirst}
                                    aria-label="Toggle failures first ordering"
                                    onClick={() => setFailuresFirst((prev) => !prev)}
                                    className={cn(
                                        "rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                                        failuresFirst
                                            ? "border-danger-200 bg-danger-500/10 text-danger-500"
                                            : "border-stroke text-ink-muted hover:bg-surface-muted",
                                    )}
                                >
                                    Failures first
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={showFailedOnly}
                                    aria-label="Toggle failed tests only"
                                    onClick={handleToggleShowFailedOnly}
                                    className={cn(
                                        "rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                                        showFailedOnly
                                            ? "border-danger-200 bg-danger-500/10 text-danger-500"
                                            : "border-stroke text-ink-muted hover:bg-surface-muted",
                                    )}
                                >
                                    Show failed only
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExpandFailedItems}
                                    disabled={failedVisibleItems.length === 0}
                                    aria-label="Expand all failed test items"
                                    className="rounded-full border border-stroke px-3 py-1 text-xs font-semibold text-ink-muted transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Expand failed
                                </button>
                            </div>
                            <div className="mt-3">
                                <SearchInput
                                    placeholder="Search test cases..."
                                    value={itemSearch}
                                    onChange={setItemSearch}
                                    containerClassName="w-full"
                                />
                            </div>
                        </div>

                        {visibleItems.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-stroke px-4 py-6 text-center text-sm text-ink-muted">
                                {items.length === 0
                                    ? "There are no items for this run."
                                    : "No items found matching current filters."}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {visibleItems.map((item) => {
                                    const edit = itemEdits[item.id] ?? {
                                        status: item.status,
                                        durationMs: item.durationMs ? String(item.durationMs) : "",
                                        errorMessage: item.errorMessage ?? "",
                                    };
                                    const effectiveStatus = edit.status;
                                    const isExpanded = expandedItems.has(item.id);
                                    const showErrorField =
                                        effectiveStatus === "failed" || Boolean(edit.errorMessage.trim());
                                    const title = splitTestTitle(item.testCase.title, item.testCase.externalKey);
                                    const durationValue = edit.durationMs
                                        ? Number(edit.durationMs)
                                        : item.durationMs;

                                    return (
                                        <article
                                            key={item.id}
                                            className={cn(
                                                "overflow-hidden rounded-lg border bg-surface-elevated transition-colors dark:bg-surface-muted",
                                                effectiveStatus === "failed"
                                                    ? "border-danger-200 bg-danger-500/5"
                                                    : "border-stroke",
                                            )}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleExpandedItem(item.id)}
                                                aria-expanded={isExpanded}
                                                aria-controls={`run-item-panel-${item.id}`}
                                                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted/30"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-ink [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                                                        {title.primary}
                                                    </p>
                                                    <p className="mt-1 text-xs text-ink-muted">
                                                        {title.secondary || "No code"}
                                                    </p>
                                                    <p className="mt-1 text-xs text-ink-muted">
                                                        {item.executedBy?.fullName ??
                                                            item.executedBy?.email ??
                                                            "No executor"}
                                                        {item.executedAt
                                                            ? ` · ${formatDate(item.executedAt)}`
                                                            : ""}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <Badge tone={itemStatusTones[effectiveStatus]}>
                                                        {itemStatusLabels[effectiveStatus]}
                                                    </Badge>
                                                    <span className="text-xs text-ink-muted">
                                                        {formatDuration(durationValue)}
                                                    </span>
                                                    {isExpanded ? (
                                                        <ChevronDownIcon className="h-4 w-4 text-ink-muted" />
                                                    ) : (
                                                        <ChevronRightIcon className="h-4 w-4 text-ink-muted" />
                                                    )}
                                                </div>
                                            </button>

                                            {isExpanded ? (
                                                <div
                                                    id={`run-item-panel-${item.id}`}
                                                    className="border-t border-stroke px-4 py-3"
                                                >
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <label className="space-y-1">
                                                            <span className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                                                Status
                                                            </span>
                                                            {canManage ? (
                                                                <select
                                                                    value={edit.status}
                                                                    onChange={(event) =>
                                                                        handleItemChange(
                                                                            item.id,
                                                                            "status",
                                                                            event.target.value,
                                                                        )
                                                                    }
                                                                    className="w-full rounded-lg border border-stroke px-3 py-2 text-sm text-ink"
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
                                                                <div className="pt-1">
                                                                    <Badge tone={itemStatusTones[effectiveStatus]}>
                                                                        {itemStatusLabels[effectiveStatus]}
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                        </label>
                                                        <label className="space-y-1">
                                                            <span className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                                                Duration (ms)
                                                            </span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={edit.durationMs}
                                                                disabled={!canManage}
                                                                onChange={(event) =>
                                                                    handleItemChange(
                                                                        item.id,
                                                                        "durationMs",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                                className="w-full rounded-lg border border-stroke px-3 py-2 text-sm text-ink disabled:bg-surface-muted"
                                                            />
                                                        </label>
                                                        {showErrorField ? (
                                                            <label className="space-y-1 md:col-span-2">
                                                                <span className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                                                    Error
                                                                </span>
                                                                <input
                                                                    type="text"
                                                                    value={edit.errorMessage}
                                                                    disabled={!canManage}
                                                                    onChange={(event) =>
                                                                        handleItemChange(
                                                                            item.id,
                                                                            "errorMessage",
                                                                            event.target.value,
                                                                        )
                                                                    }
                                                                    className="w-full rounded-lg border border-stroke px-3 py-2 text-sm text-ink disabled:bg-surface-muted"
                                                                    placeholder="Error details"
                                                                />
                                                            </label>
                                                        ) : null}
                                                        <div className="md:col-span-2 rounded-md border border-dashed border-stroke px-3 py-2 text-xs text-ink-muted">
                                                            Artifacts section placeholder
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                        {totalItems > ITEM_FETCH_PAGE_SIZE ? (
                            <p className="text-xs text-ink-muted">
                                Showing first {items.length} of {totalItems} items in this view.
                            </p>
                        ) : null}
                    </div>
                ) : null}

                {!loading && !error && tab === "artifacts" ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-lg border border-stroke bg-surface-elevated px-4 py-3 dark:bg-surface-muted">
                            <div>
                                <p className="text-sm font-semibold text-ink">
                                    Artifacts ({normalizedArtifacts.length})
                                </p>
                                <p className="text-xs text-ink-muted">
                                    Browse, preview, and manage run evidence
                                </p>
                            </div>
                            {canManage ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={showArtifactForm ? "secondary" : "soft"}
                                    className="rounded-full"
                                    onClick={() => setShowArtifactForm((prev) => !prev)}
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    {showArtifactForm ? "Hide upload form" : "Upload artifact"}
                                </Button>
                            ) : null}
                        </div>

                        {normalizedArtifacts.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-stroke px-4 py-8 text-center text-sm text-ink-muted">
                                <p>No artifacts found for this run.</p>
                                {canManage ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="soft"
                                        className="mt-3 rounded-full"
                                        onClick={() => setShowArtifactForm(true)}
                                    >
                                        Upload artifact
                                    </Button>
                                ) : null}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {groupedArtifacts.map((group) => (
                                    <section key={group.key} className="space-y-2">
                                        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                            {group.title} ({group.items.length})
                                        </p>
                                        <div className="space-y-2">
                                            {group.items.map((artifact) => (
                                                <article
                                                    key={artifact.id}
                                                    className="rounded-lg border border-stroke bg-surface-elevated p-3 dark:bg-surface-muted"
                                                >
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                                                                <span className="text-ink-muted">
                                                                    {getArtifactIcon(artifact.resolvedType)}
                                                                </span>
                                                                <span className="truncate">
                                                                    {artifact.name || "Unnamed artifact"}
                                                                </span>
                                                            </p>
                                                            <p className="mt-1 text-xs text-ink-muted">
                                                                {artifactTypeLabels[artifact.resolvedType]} ·{" "}
                                                                {formatSize(artifact.sizeBytes)} ·{" "}
                                                                {formatDate(artifact.createdAt)}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                                            {artifact.previewable ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handlePreviewArtifact(artifact)}
                                                                    className="inline-flex items-center gap-1 rounded-full border border-stroke px-2.5 py-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                                                                >
                                                                    <EyeIcon className="h-4 w-4" />
                                                                    {artifact.isHtml ? "Open" : "Preview"}
                                                                </button>
                                                            ) : null}
                                                            <a
                                                                href={artifact.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 rounded-full border border-stroke px-2.5 py-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                                                            >
                                                                <ArrowDownTrayIcon className="h-4 w-4" />
                                                                {artifact.resolvedType === "link" ? "Open" : "Download"}
                                                            </a>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCopyArtifactUrl(artifact.url)}
                                                                className="inline-flex items-center gap-1 rounded-full border border-stroke px-2.5 py-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                                                            >
                                                                <ClipboardDocumentIcon className="h-4 w-4" />
                                                                Copy link
                                                            </button>
                                                            {canManage ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteArtifact(artifact.id)}
                                                                    className="inline-flex items-center gap-1 rounded-full border border-danger-200 px-2.5 py-1 text-danger-500 transition-colors hover:bg-danger-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                                                                >
                                                                    <TrashIcon className="h-4 w-4" />
                                                                    Delete
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        )}

                        {canManage && showArtifactForm ? (
                            <div className="rounded-lg border border-stroke bg-surface-elevated p-4 dark:bg-surface-muted">
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setArtifactMode("file");
                                            setArtifactForm((prev) => ({ ...prev, url: "" }));
                                            setArtifactFieldErrors((prev) => ({ ...prev, url: undefined }));
                                        }}
                                        className={cn(
                                            "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                                            artifactMode === "file"
                                                ? "bg-brand-50 text-brand-700"
                                                : "border border-stroke text-ink-muted hover:bg-surface-muted",
                                        )}
                                    >
                                        Upload file
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setArtifactMode("url");
                                            setArtifactFile(null);
                                            setArtifactFieldErrors((prev) => ({ ...prev, file: undefined }));
                                        }}
                                        className={cn(
                                            "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                                            artifactMode === "url"
                                                ? "bg-brand-50 text-brand-700"
                                                : "border border-stroke text-ink-muted hover:bg-surface-muted",
                                        )}
                                    >
                                        Add link
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
                                            onChange={(event) => {
                                                setArtifactForm((prev) => ({
                                                    ...prev,
                                                    type: event.target.value,
                                                }));
                                                setArtifactFieldErrors((prev) => ({
                                                    ...prev,
                                                    type: undefined,
                                                }));
                                            }}
                                            className="w-full rounded-lg border border-stroke px-3 py-2 text-sm text-ink"
                                        >
                                            {["screenshot", "video", "log", "report", "link", "other"].map((type) => (
                                                <option key={type} value={type}>
                                                    {type.toUpperCase()}
                                                </option>
                                            ))}
                                        </select>
                                        {artifactFieldErrors.type ? (
                                            <p className="text-xs text-danger-500">{artifactFieldErrors.type}</p>
                                        ) : null}
                                    </label>
                                    <label className="space-y-1 md:col-span-2">
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
                                            placeholder="Optional display name"
                                        />
                                    </label>
                                    {artifactMode === "url" ? (
                                        <label className="space-y-1 md:col-span-2">
                                            <span className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                                URL
                                            </span>
                                            <input
                                                type="text"
                                                value={artifactForm.url}
                                                onChange={(event) => {
                                                    setArtifactForm((prev) => ({
                                                        ...prev,
                                                        url: event.target.value,
                                                    }));
                                                    setArtifactFieldErrors((prev) => ({
                                                        ...prev,
                                                        url: undefined,
                                                    }));
                                                }}
                                                className={cn(
                                                    "w-full rounded-lg border px-3 py-2 text-sm text-ink",
                                                    artifactFieldErrors.url
                                                        ? "border-danger-500"
                                                        : "border-stroke",
                                                )}
                                                placeholder="https://..."
                                            />
                                            {artifactFieldErrors.url ? (
                                                <p className="text-xs text-danger-500">
                                                    {artifactFieldErrors.url}
                                                </p>
                                            ) : null}
                                        </label>
                                    ) : (
                                        <div className="space-y-2 md:col-span-2">
                                            <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                                                File
                                            </p>
                                            <label
                                                htmlFor="artifact-file-input"
                                                onDragOver={(event) => {
                                                    event.preventDefault();
                                                    setIsArtifactDropActive(true);
                                                }}
                                                onDragLeave={() => setIsArtifactDropActive(false)}
                                                onDrop={handleArtifactDrop}
                                                className={cn(
                                                    "block cursor-pointer rounded-lg border border-dashed px-4 py-6 text-center text-sm transition-colors",
                                                    isArtifactDropActive
                                                        ? "border-brand-400 bg-brand-50/60"
                                                        : "border-stroke text-ink-muted hover:bg-surface-muted",
                                                )}
                                            >
                                                <input
                                                    id="artifact-file-input"
                                                    key={artifactFile ? artifactFile.name : "empty"}
                                                    type="file"
                                                    className="sr-only"
                                                    onChange={(event) => {
                                                        setArtifactFile(event.target.files?.[0] ?? null);
                                                        setArtifactFieldErrors((prev) => ({
                                                            ...prev,
                                                            file: undefined,
                                                        }));
                                                    }}
                                                />
                                                <p className="font-medium text-ink">
                                                    Drop file here or click to select
                                                </p>
                                                <p className="mt-1 text-xs text-ink-muted">
                                                    Supports screenshots, logs, reports, videos and more
                                                </p>
                                                {artifactFile ? (
                                                    <p className="mt-2 text-xs text-ink-muted">
                                                        {artifactFile.name} · {formatSize(artifactFile.size)}
                                                    </p>
                                                ) : null}
                                            </label>
                                            {artifactFieldErrors.file ? (
                                                <p className="text-xs text-danger-500">
                                                    {artifactFieldErrors.file}
                                                </p>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleCreateArtifact}
                                        disabled={savingArtifact}
                                        className="rounded-full"
                                    >
                                        {savingArtifact
                                            ? "Saving..."
                                            : artifactMode === "file"
                                                ? "Upload artifact"
                                                : "Add link"}
                                    </Button>
                                </div>
                            </div>
                        ) : null}
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

