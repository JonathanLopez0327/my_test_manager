"use client";

import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { IconCheck, IconPlay, IconPaperClip, IconX } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

type RunItemStatus = "passed" | "failed" | "skipped" | "blocked" | "not_run";
export type ExecutionStatus = "passed" | "failed" | "not_run";

export type ExecutionItemRecord = {
  id: string;
  status: RunItemStatus;
  testCase: {
    id: string;
    title: string;
    externalKey: string | null;
    preconditions: string | null;
    steps: unknown;
    style: "step_by_step" | "gherkin" | "data_driven" | "api";
  };
};

export type ExecutionArtifactRecord = {
  id: string;
  type: string | null;
  name: string | null;
  url: string;
  mimeType: string | null;
  createdAt: string;
  metadata?: unknown;
};

export type ExecutionStepState = {
  status: ExecutionStatus;
};

type ExecutionSavePayload = {
  status: ExecutionStatus;
  stepState: ExecutionStepState[];
  stepFiles: Record<number, File[]>;
};

type TestRunExecutionModalProps = {
  open: boolean;
  runId: string | null;
  item: ExecutionItemRecord | null;
  canManage: boolean;
  onClose: () => void;
  onLoadArtifacts: (runId: string, runItemId: string) => Promise<ExecutionArtifactRecord[]>;
  onSave: (payload: ExecutionSavePayload) => Promise<void>;
};

type ParsedStep = {
  text: string;
  expected?: string | null;
};

type ExecutionArtifactMeta = {
  scope?: "step";
  stepIndex?: number;
};

const statusTone: Record<ExecutionStatus, "success" | "danger" | "neutral"> = {
  passed: "success",
  failed: "danger",
  not_run: "neutral",
};

export function TestRunExecutionModal({
  open,
  runId,
  item,
  canManage,
  onClose,
  onLoadArtifacts,
  onSave,
}: TestRunExecutionModalProps) {
  const [stepState, setStepState] = useState<ExecutionStepState[]>([]);
  const [stepDraftFiles, setStepDraftFiles] = useState<Record<number, File[]>>({});
  const [stepExistingCounts, setStepExistingCounts] = useState<Record<number, number>>({});

  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [artifactsError, setArtifactsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const parsedSteps = useMemo(
    () => parseSteps(item?.testCase.style, item?.testCase.steps),
    [item?.testCase.steps, item?.testCase.style],
  );
  const stepCount = parsedSteps.length;
  const executionStatus = useMemo(
    () => deriveExecutionStatus(stepState, stepCount),
    [stepCount, stepState],
  );

  const hasChanges = useMemo(() => {
    const hasStepChanges = stepState.some((step) => step.status !== "not_run");
    const hasFiles = Object.values(stepDraftFiles).some((files) => files.length > 0);
    return hasStepChanges || hasFiles;
  }, [stepDraftFiles, stepState]);

  useEffect(() => {
    if (!open || !item) return;
    setStepDraftFiles({});
    setStepExistingCounts({});
    setFileError(null);
    setSaveError(null);
    setStepState(buildDefaultStepState(parsedSteps.length));
  }, [item, open, parsedSteps.length]);

  useEffect(() => {
    if (!open || !item || !runId) return;

    let isMounted = true;
    setLoadingArtifacts(true);
    setArtifactsError(null);

    void onLoadArtifacts(runId, item.id)
      .then((records) => {
        if (!isMounted) return;
        const nextStepCounts: Record<number, number> = {};
        records.filter(isImageArtifact).forEach((artifact) => {
          const meta = parseExecutionArtifactMeta(artifact.metadata);
          if (meta.scope === "step" && Number.isInteger(meta.stepIndex)) {
            const stepIndex = Number(meta.stepIndex);
            if (stepIndex >= 0) {
              nextStepCounts[stepIndex] = (nextStepCounts[stepIndex] ?? 0) + 1;
            }
          }
        });
        setStepExistingCounts(nextStepCounts);
      })
      .catch((error) => {
        if (!isMounted) return;
        setArtifactsError(error instanceof Error ? error.message : "Could not load evidence.");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoadingArtifacts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [item, onLoadArtifacts, open, runId]);

  const handlePersist = async () => {
    if (!canManage || !item || !hasChanges) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        status: executionStatus,
        stepState,
        stepFiles: stepDraftFiles,
      });
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save execution.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="4xl" closeOnEsc trapFocus title="Execute test case">
      {!item ? null : (
        <div className="space-y-3">
          <header className="rounded-lg border border-stroke bg-surface-elevated px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-brand-700">
                  {item.testCase.title}
                </p>
                <p className="truncate text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                  {item.testCase.externalKey ?? "No key"}
                </p>
              </div>
              <Badge tone={statusTone[executionStatus]} className="px-2 py-1 text-[10px] uppercase tracking-[0.12em]">
                {executionStatus.replace("_", " ")}
              </Badge>
            </div>
          </header>

          <section className="rounded-lg border border-stroke bg-surface">
            <div className="flex items-center justify-between border-b border-stroke px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                <IconPlay className="h-3.5 w-3.5" />
                Steps
              </div>
              <span className="text-xs text-ink-muted">{stepCount} total</span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {stepCount === 0 ? (
                <p className="px-2 py-4 text-sm text-ink-muted">No steps available for this case.</p>
              ) : (
                <div className="space-y-2">
                  {parsedSteps.map((step, index) => (
                    <StepExecutionRow
                      key={`step-${index}`}
                      index={index}
                      step={step}
                      status={stepState[index]?.status ?? "not_run"}
                      canManage={canManage}
                      saving={saving}
                      evidenceCount={(stepExistingCounts[index] ?? 0) + (stepDraftFiles[index]?.length ?? 0)}
                      onSetStatus={(status) => {
                        setStepState((prev) => {
                          const next = [...prev];
                          next[index] = { status };
                          return next;
                        });
                      }}
                      onAttachFiles={(files) => {
                        setStepDraftFiles((prev) => ({
                          ...prev,
                          [index]: [...(prev[index] ?? []), ...files],
                        }));
                      }}
                      onInvalidFiles={() => setFileError("Only image files are allowed.")}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {loadingArtifacts ? <p className="text-xs text-ink-muted">Loading evidence...</p> : null}
          {artifactsError ? (
            <div className="border border-danger-500/20 bg-danger-500/10 px-3 py-2 text-xs text-danger-600">
              {artifactsError}
            </div>
          ) : null}
          {fileError ? (
            <div className="border border-danger-500/20 bg-danger-500/10 px-3 py-2 text-xs text-danger-600">
              {fileError}
            </div>
          ) : null}
          {saveError ? (
            <div className="border border-danger-500/20 bg-danger-500/10 px-3 py-2 text-xs text-danger-600">
              {saveError}
            </div>
          ) : null}

          <footer className="flex items-center justify-end gap-2 rounded-lg border border-stroke bg-surface-elevated px-3 py-2.5">
            <Button type="button" variant="quiet" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handlePersist()} disabled={!canManage || saving || !hasChanges}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </footer>
        </div>
      )}
    </Modal>
  );
}

type StepExecutionRowProps = {
  index: number;
  step: ParsedStep;
  status: ExecutionStatus;
  evidenceCount: number;
  canManage: boolean;
  saving: boolean;
  onSetStatus: (status: ExecutionStatus) => void;
  onAttachFiles: (files: File[]) => void;
  onInvalidFiles: () => void;
};

function StepExecutionRow({
  index,
  step,
  status,
  evidenceCount,
  canManage,
  saving,
  onSetStatus,
  onAttachFiles,
  onInvalidFiles,
}: StepExecutionRowProps) {
  const inputId = useId();

  const handleFiles = (list: FileList | null) => {
    const accepted = collectImageFiles(list);
    if (!accepted.ok) {
      onInvalidFiles();
      return;
    }
    if (accepted.files.length > 0) onAttachFiles(accepted.files);
  };

  const isPassed = status === "passed";
  const isFailed = status === "failed";

  return (
    <article className="rounded-md border border-stroke bg-surface-elevated px-3 py-2">
      <input
        id={inputId}
        type="file"
        className="sr-only"
        accept="image/*"
        multiple
        aria-label={`Attach evidence for step ${index + 1}`}
        disabled={!canManage || saving}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">Step {index + 1}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{step.text}</p>
          {step.expected ? (
            <p className="mt-1 text-xs text-ink-muted">Expected: {step.expected}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onSetStatus("passed")}
            disabled={!canManage || saving}
            aria-pressed={isPassed}
            aria-label={`Mark step ${index + 1} as passed`}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded border transition-colors",
              isPassed
                ? "border-success-500/50 bg-success-500/15 text-success-500"
                : "border-stroke text-ink-muted hover:border-stroke-strong hover:bg-surface-muted hover:text-ink",
            )}
          >
            <IconCheck className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onSetStatus("failed")}
            disabled={!canManage || saving}
            aria-pressed={isFailed}
            aria-label={`Mark step ${index + 1} as failed`}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded border transition-colors",
              isFailed
                ? "border-danger-500/50 bg-danger-500/15 text-danger-500"
                : "border-stroke text-ink-muted hover:border-stroke-strong hover:bg-surface-muted hover:text-ink",
            )}
          >
            <IconX className="h-4 w-4" />
          </button>
          <label
            htmlFor={inputId}
            className={cn(
              "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border transition-colors",
              !canManage || saving
                ? "cursor-not-allowed border-stroke text-ink-soft opacity-60"
                : "border-stroke text-ink-muted hover:border-stroke-strong hover:bg-surface-muted hover:text-ink",
            )}
            aria-label={`Attach evidence to step ${index + 1}`}
            title={`Attach evidence to step ${index + 1}`}
          >
            <IconPaperClip className="h-4 w-4" />
          </label>
          {evidenceCount > 0 ? (
            <span className="inline-flex min-w-6 items-center justify-center rounded border border-stroke bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
              {evidenceCount}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function isImageArtifact(artifact: ExecutionArtifactRecord) {
  const mimeType = (artifact.mimeType ?? "").toLowerCase();
  const url = artifact.url.toLowerCase();
  return mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url);
}

function parseExecutionArtifactMeta(metadata: unknown): ExecutionArtifactMeta {
  if (!metadata || typeof metadata !== "object") return {};
  const raw = metadata as Record<string, unknown>;
  const scope = raw.scope === "step" ? raw.scope : undefined;
  const stepIndex = Number(raw.stepIndex);
  return {
    scope,
    stepIndex: Number.isInteger(stepIndex) && stepIndex >= 0 ? stepIndex : undefined,
  };
}

function collectImageFiles(list: FileList | null): { ok: true; files: File[] } | { ok: false } {
  if (!list) return { ok: true, files: [] };
  const files = Array.from(list);
  const onlyImages = files.every((file) => file.type.startsWith("image/"));
  if (!onlyImages) return { ok: false };
  return { ok: true, files };
}

function buildDefaultStepState(count: number): ExecutionStepState[] {
  return Array.from({ length: count }, () => ({
    status: "not_run",
  }));
}

function deriveExecutionStatus(stepState: ExecutionStepState[], stepCount: number): ExecutionStatus {
  if (stepState.some((step) => step.status === "failed")) return "failed";
  if (stepCount > 0 && stepState.length >= stepCount && stepState.every((step) => step.status === "passed")) {
    return "passed";
  }
  return "not_run";
}

function parseSteps(style: ExecutionItemRecord["testCase"]["style"] | undefined, steps: unknown): ParsedStep[] {
  if (!steps) return [];

  if (style === "step_by_step" && Array.isArray(steps)) {
    return steps
      .map((entry) => {
        if (typeof entry === "string") return { text: entry };
        if (!entry || typeof entry !== "object") return null;
        const value = entry as { step?: unknown; expectedResult?: unknown };
        return {
          text: typeof value.step === "string" ? value.step : "",
          expected: typeof value.expectedResult === "string" ? value.expectedResult : null,
        };
      })
      .filter((entry): entry is ParsedStep => Boolean(entry?.text?.trim()));
  }

  if (style === "gherkin" && Array.isArray(steps)) {
    return steps
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const value = entry as { keyword?: unknown; text?: unknown };
        const keyword = typeof value.keyword === "string" ? value.keyword : "";
        const text = typeof value.text === "string" ? value.text : "";
        return { text: `${keyword} ${text}`.trim() };
      })
      .filter((entry): entry is ParsedStep => Boolean(entry?.text?.trim()));
  }

  if (style === "data_driven" && typeof steps === "object" && steps !== null) {
    const value = steps as { template?: unknown };
    if (Array.isArray(value.template)) {
      return value.template
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const row = entry as { keyword?: unknown; text?: unknown };
          const keyword = typeof row.keyword === "string" ? row.keyword : "";
          const text = typeof row.text === "string" ? row.text : "";
          return { text: `${keyword} ${text}`.trim() };
        })
        .filter((entry): entry is ParsedStep => Boolean(entry?.text?.trim()));
    }
  }

  if (style === "api" && typeof steps === "object" && steps !== null) {
    const value = steps as {
      request?: { method?: unknown; endpoint?: unknown };
      expectedResponse?: { status?: unknown };
    };
    const method = typeof value.request?.method === "string" ? value.request.method : "REQUEST";
    const endpoint = typeof value.request?.endpoint === "string" ? value.request.endpoint : "/";
    const status = typeof value.expectedResponse?.status === "string" ? value.expectedResponse.status : "N/A";
    return [{ text: `${method} ${endpoint}`, expected: `Expected status ${status}` }];
  }

  if (Array.isArray(steps)) {
    return steps
      .map((entry) => (typeof entry === "string" ? { text: entry } : null))
      .filter((entry): entry is ParsedStep => Boolean(entry?.text?.trim()));
  }

  return [];
}
