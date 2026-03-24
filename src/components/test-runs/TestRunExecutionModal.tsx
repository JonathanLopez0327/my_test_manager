"use client";

import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { IconCheck, IconPlay, IconPaperClip, IconX } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { parseSteps, type ParsedStep } from "@/lib/parse-steps";

export type ExecutionStatus = "passed" | "failed" | "skipped" | "blocked" | "not_run" | "in_progress";
type StepStatus = "passed" | "failed" | "not_run";
type GlobalResultOption = "not_run" | "in_progress" | "pass_test" | "fail_test" | "pause_test" | "block_test" | "not_applicable";

export type ExecutionItemRecord = {
  id: string;
  status: ExecutionStatus;
  attemptCount?: number;
  latestAttemptNumber?: number | null;
  currentExecutionId?: string | null;
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

export type ExecutionStepResultRecord = {
  id: string;
  stepIndex: number;
  stepTextSnapshot: string;
  expectedSnapshot: string | null;
  status: ExecutionStatus;
  actualResult: string | null;
  comment: string | null;
};

export type ExecutionHistoryItemRecord = {
  id: string;
  attemptNumber: number;
  status: ExecutionStatus;
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;
  executedBy: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
};

export type ExecutionHistoryResponse = {
  currentExecutionId: string | null;
  items: ExecutionHistoryItemRecord[];
};

export type ExecutionDetailRecord = {
  id: string;
  attemptNumber: number;
  status: ExecutionStatus;
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;
  stepResults: ExecutionStepResultRecord[];
  artifacts: ExecutionArtifactRecord[];
  runItem: {
    currentExecutionId: string | null;
  };
};

export type ExecutionStepUpdate = {
  stepIndex: number;
  status: StepStatus;
  actualResult?: string | null;
  comment?: string | null;
};

type ExecutionSavePayload = {
  executionId: string | null;
  status: ExecutionStatus;
  durationMs: number;
  summary: string | null;
  stepResults: ExecutionStepUpdate[];
  stepFiles: Record<number, File[]>;
};

type TestRunExecutionModalProps = {
  open: boolean;
  runId: string | null;
  item: ExecutionItemRecord | null;
  canManage: boolean;
  startNewExecution?: boolean;
  onClose: () => void;
  onCreateExecution: (runId: string, runItemId: string) => Promise<string>;
  onLoadExecutions: (runId: string, runItemId: string) => Promise<ExecutionHistoryResponse>;
  onLoadExecutionDetail: (runId: string, runItemId: string, executionId: string) => Promise<ExecutionDetailRecord>;
  onSave: (payload: ExecutionSavePayload) => Promise<void>;
};


type ExecutionArtifactMeta = {
  scope?: "step";
  stepIndex?: number;
};

export type ExecutionStepState = {
  status: StepStatus;
  comment: string;
};

const statusTone: Record<ExecutionStatus, "success" | "danger" | "warning" | "neutral"> = {
  passed: "success",
  failed: "danger",
  blocked: "warning",
  skipped: "neutral",
  not_run: "neutral",
  in_progress: "warning",
};

const globalResultOptions: Array<{ key: Exclude<GlobalResultOption, "not_run" | "in_progress">; label: string }> = [
  { key: "pass_test", label: "Pass test" },
  { key: "fail_test", label: "Fail test" },
  { key: "pause_test", label: "Pause test" },
  { key: "block_test", label: "Block test" },
  { key: "not_applicable", label: "Not applicable" },
];

export function TestRunExecutionModal({
  open,
  runId,
  item,
  canManage,
  startNewExecution,
  onClose,
  onCreateExecution,
  onLoadExecutions,
  onLoadExecutionDetail,
  onSave,
}: TestRunExecutionModalProps) {
  const [executions, setExecutions] = useState<ExecutionHistoryItemRecord[]>([]);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [loadingExecutionDetail, setLoadingExecutionDetail] = useState(false);
  const [executionDetail, setExecutionDetail] = useState<ExecutionDetailRecord | null>(null);

  const [stepState, setStepState] = useState<ExecutionStepState[]>([]);
  const [baselineStepState, setBaselineStepState] = useState<ExecutionStepState[]>([]);
  const [stepDraftFiles, setStepDraftFiles] = useState<Record<number, File[]>>({});
  const [stepExistingCounts, setStepExistingCounts] = useState<Record<number, number>>({});
  const [selectedGlobalResult, setSelectedGlobalResult] = useState<GlobalResultOption>("not_run");
  const [baselineGlobalStatus, setBaselineGlobalStatus] = useState<ExecutionStatus>("not_run");
  const [summary, setSummary] = useState("");
  const [baselineSummary, setBaselineSummary] = useState("");

  const [artifactsError, setArtifactsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [modalOpenedAt, setModalOpenedAt] = useState<number | null>(null);

  const selectedGlobalStatus = mapGlobalResultToStatus(selectedGlobalResult);
  const isResultSelected = selectedGlobalResult !== "not_run" && selectedGlobalResult !== "in_progress";
  const parsedFromItem = useMemo(
    () => parseSteps(item?.testCase.style, item?.testCase.steps),
    [item?.testCase.style, item?.testCase.steps],
  );

  const stepsForRendering = useMemo(() => {
    if (executionDetail && executionDetail.stepResults.length > 0) {
      return executionDetail.stepResults
        .sort((a, b) => a.stepIndex - b.stepIndex)
        .map((result) => ({
          text: result.stepTextSnapshot,
          expected: result.expectedSnapshot,
        }));
    }
    return parsedFromItem;
  }, [executionDetail, parsedFromItem]);

  const isReadOnlyExecution = Boolean(selectedExecutionId && currentExecutionId && selectedExecutionId !== currentExecutionId);

  const hasChanges = useMemo(() => {
    const hasStepChanges = stepState.some((step, index) => {
      const baseline = baselineStepState[index];
      return step.status !== (baseline?.status ?? "not_run") || step.comment !== (baseline?.comment ?? "");
    });
    const hasFiles = Object.values(stepDraftFiles).some((files) => files.length > 0);
    const hasStatusChange = selectedGlobalStatus !== baselineGlobalStatus;
    const hasSummaryChange = summary !== baselineSummary;
    return hasStepChanges || hasFiles || hasStatusChange || hasSummaryChange;
  }, [baselineGlobalStatus, baselineStepState, baselineSummary, selectedGlobalStatus, stepDraftFiles, stepState, summary]);

  useEffect(() => {
    if (!open || !item || !runId) return;
    const hasExistingExecutions = Boolean(item.currentExecutionId) || (item.attemptCount ?? 0) > 0;

    let canceled = false;
    setLoadingExecutions(true);
    setArtifactsError(null);
    setSaveError(null);
    setFileError(null);
    setStepDraftFiles({});
    setExecutionDetail(null);
    setStepExistingCounts({});
    setStepState(Array.from({ length: parsedFromItem.length }, () => ({ status: "not_run" as const, comment: "" })));
    setBaselineStepState(Array.from({ length: parsedFromItem.length }, () => ({ status: "not_run" as const, comment: "" })));
    setSelectedGlobalResult("not_run");
    setBaselineGlobalStatus("not_run");
    setSummary("");
    setBaselineSummary("");

    void (async () => {
      try {
        if (hasExistingExecutions) {
          const payload = await onLoadExecutions(runId, item.id);
          if (canceled) return;
          setExecutions(payload.items);
          setCurrentExecutionId(payload.currentExecutionId);
          if (startNewExecution) {
            setSelectedExecutionId(null);
          } else {
            setSelectedExecutionId(payload.currentExecutionId ?? payload.items[0]?.id ?? null);
          }
        } else {
          // No existing executions — start with clean state; execution created on save
          setExecutions([]);
          setCurrentExecutionId(null);
          setSelectedExecutionId(null);
        }
      } catch (error) {
        if (canceled) return;
        setArtifactsError(error instanceof Error ? error.message : "Could not load execution history.");
      } finally {
        if (canceled) return;
        setLoadingExecutions(false);
      }
    })();

    return () => {
      canceled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, open, runId]);

  useEffect(() => {
    if (!open) {
      setModalOpenedAt(null);
      return;
    }
    if (modalOpenedAt === null) {
      setModalOpenedAt(Date.now());
    }
  }, [modalOpenedAt, open]);

  useEffect(() => {
    if (!open || !item || !runId || !selectedExecutionId) return;

    let canceled = false;
    setLoadingExecutionDetail(true);
    setArtifactsError(null);
    setSaveError(null);
    setFileError(null);
    setStepDraftFiles({});

    void onLoadExecutionDetail(runId, item.id, selectedExecutionId)
      .then((detail) => {
        if (canceled) return;
        setExecutionDetail(detail);
        setCurrentExecutionId(detail.runItem.currentExecutionId);

        const nextGlobalStatus = detail.status;
        setBaselineGlobalStatus(nextGlobalStatus);
        setSelectedGlobalResult(mapStatusToGlobalResult(nextGlobalStatus));

        const nextSummary = detail.summary ?? "";
        setSummary(nextSummary);
        setBaselineSummary(nextSummary);

        const mergedStepState = buildStepStateFromDetail(detail, parsedFromItem.length);
        setStepState(mergedStepState);
        setBaselineStepState(mergedStepState);

        const nextCounts: Record<number, number> = {};
        detail.artifacts.filter(isImageArtifact).forEach((artifact) => {
          const meta = parseExecutionArtifactMeta(artifact.metadata);
          if (meta.scope === "step" && Number.isInteger(meta.stepIndex) && (meta.stepIndex ?? -1) >= 0) {
            const index = Number(meta.stepIndex);
            nextCounts[index] = (nextCounts[index] ?? 0) + 1;
          }
        });
        setStepExistingCounts(nextCounts);
      })
      .catch((error) => {
        if (canceled) return;
        setArtifactsError(error instanceof Error ? error.message : "Could not load execution details.");
      })
      .finally(() => {
        if (canceled) return;
        setLoadingExecutionDetail(false);
      });

    return () => {
      canceled = true;
    };
  }, [item, onLoadExecutionDetail, open, parsedFromItem.length, runId, selectedExecutionId]);

  const handlePersist = async () => {
    if (!canManage || !item || !runId || isReadOnlyExecution || !hasChanges || !isResultSelected) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Create execution on save if none exists or a new attempt is requested
      let execId = selectedExecutionId;
      if (!execId || startNewExecution) {
        execId = await onCreateExecution(runId, item.id);
        setSelectedExecutionId(execId);
        setCurrentExecutionId(execId);
      }

      const durationMs = Math.max(1, Date.now() - (modalOpenedAt ?? Date.now()));
      await onSave({
        executionId: execId,
        status: selectedGlobalStatus,
        durationMs,
        summary: summary.trim() || null,
        stepResults: stepState.map((step, stepIndex) => ({
          stepIndex,
          status: step.status,
          comment: step.comment.trim() || null,
        })),
        stepFiles: stepDraftFiles,
      });

      const [history, detail] = await Promise.all([
        onLoadExecutions(runId, item.id),
        onLoadExecutionDetail(runId, item.id, execId),
      ]);
      setExecutions(history.items);
      setCurrentExecutionId(history.currentExecutionId);
      setExecutionDetail(detail);
      setBaselineGlobalStatus(detail.status);
      const mergedStepState = buildStepStateFromDetail(detail, parsedFromItem.length);
      setStepState(mergedStepState);
      setBaselineStepState(mergedStepState);
      setStepDraftFiles({});
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save execution.");
    } finally {
      setSaving(false);
    }
  };

  const selectedExecution = executions.find((execution) => execution.id === selectedExecutionId) ?? null;

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
                <p className="mt-1 text-xs text-ink-muted">
                  {selectedExecution ? `Execution #${selectedExecution.attemptNumber}` : "No execution"}
                </p>
              </div>
              <Badge tone={statusTone[selectedGlobalStatus]} className="px-2 py-1 text-[10px] uppercase tracking-[0.12em]">
                {formatStatusLabel(selectedGlobalStatus)}
              </Badge>
            </div>

            {isReadOnlyExecution ? (
              <p className="mt-3 text-xs font-medium text-ink-soft">Read-only (historical attempt)</p>
            ) : null}
          </header>

          <section className="rounded-lg border border-stroke bg-surface">
            <div className="flex items-center justify-between border-b border-stroke px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                <IconPlay className="h-3.5 w-3.5" />
                Steps
              </div>
              <span className="text-xs text-ink-muted">
                {stepsForRendering.length} total{loadingExecutions || loadingExecutionDetail ? " · loading..." : ""}
              </span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {stepsForRendering.length === 0 && !loadingExecutions && !loadingExecutionDetail ? (
                <p className="px-2 py-4 text-sm text-ink-muted">No steps available for this case.</p>
              ) : (
                <div className="space-y-2">
                  {stepsForRendering.map((step, index) => (
                    <StepExecutionRow
                      key={`step-${index}`}
                      index={index}
                      step={step}
                      status={stepState[index]?.status ?? "not_run"}
                      comment={stepState[index]?.comment ?? ""}
                      canManage={canManage && !isReadOnlyExecution}
                      saving={saving}
                      evidenceCount={(stepExistingCounts[index] ?? 0) + (stepDraftFiles[index]?.length ?? 0)}
                      onSetStatus={(status) => {
                        setStepState((prev) => {
                          const next = [...prev];
                          const currentStatus = next[index]?.status ?? "not_run";
                          next[index] = { ...next[index], status: currentStatus === status ? "not_run" : status };
                          return next;
                        });
                      }}
                      onCommentChange={(comment) => {
                        setStepState((prev) => {
                          const next = [...prev];
                          next[index] = { ...next[index], comment };
                          return next;
                        });
                      }}
                      draftFiles={stepDraftFiles[index] ?? []}
                      onAttachFiles={(files) => {
                        setStepDraftFiles((prev) => ({
                          ...prev,
                          [index]: [...(prev[index] ?? []), ...files],
                        }));
                      }}
                      onRemoveFile={(fileIndex) => {
                        setStepDraftFiles((prev) => {
                          const next = { ...prev };
                          const files = [...(next[index] ?? [])];
                          files.splice(fileIndex, 1);
                          if (files.length === 0) {
                            delete next[index];
                          } else {
                            next[index] = files;
                          }
                          return next;
                        });
                      }}
                      onInvalidFiles={() => setFileError("Only image files are allowed.")}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

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

          <section className="rounded-lg border border-stroke bg-surface-elevated px-3 py-2.5">
            <label htmlFor="execution-summary" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Execution notes
            </label>
            <textarea
              id="execution-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              disabled={!canManage || saving || isReadOnlyExecution}
              placeholder="Add notes about this execution..."
              rows={2}
              className="w-full resize-none rounded border border-stroke bg-surface px-2 py-1.5 text-xs text-ink placeholder:text-ink-muted outline-none focus:border-brand-300 disabled:opacity-60"
            />
          </section>

          <footer className="flex items-center justify-between gap-3 rounded-lg border border-stroke bg-surface-elevated px-3 py-2.5">
            <div className="flex items-center gap-2">
              <label htmlFor="execution-global-result" className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Result
              </label>
              <select
                id="execution-global-result"
                aria-label="Overall test result"
                value={selectedGlobalResult}
                disabled={!canManage || saving || isReadOnlyExecution}
                onChange={(event) => setSelectedGlobalResult(event.target.value as GlobalResultOption)}
                className="h-8 rounded-md border border-stroke bg-surface px-2 text-xs text-ink outline-none focus:border-brand-300"
              >
                {selectedGlobalResult === "not_run" ? <option value="not_run">Not run</option> : null}
                {selectedGlobalResult === "in_progress" ? <option value="in_progress">In progress</option> : null}
                {globalResultOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="quiet" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handlePersist()} disabled={!canManage || saving || isReadOnlyExecution || !hasChanges || !isResultSelected}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </footer>
        </div>
      )}
    </Modal>
  );
}

type StepExecutionRowProps = {
  index: number;
  step: ParsedStep;
  status: StepStatus;
  comment: string;
  evidenceCount: number;
  canManage: boolean;
  saving: boolean;
  draftFiles: File[];
  onSetStatus: (status: StepStatus) => void;
  onCommentChange: (comment: string) => void;
  onAttachFiles: (files: File[]) => void;
  onRemoveFile: (fileIndex: number) => void;
  onInvalidFiles: () => void;
};

function StepExecutionRow({
  index,
  step,
  status,
  comment,
  evidenceCount,
  canManage,
  saving,
  draftFiles,
  onSetStatus,
  onCommentChange,
  onAttachFiles,
  onRemoveFile,
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
          <p className="whitespace-pre-wrap text-sm text-ink">
            <span className="mr-1 text-ink-soft">{index + 1}.</span>
            {step.text}
          </p>
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
      {draftFiles.length > 0 && canManage && !saving ? (
        <ul className="mt-2 space-y-1">
          {draftFiles.map((file, fileIndex) => (
            <li key={`${file.name}-${fileIndex}`} className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => onRemoveFile(fileIndex)}
                aria-label={`Remove ${file.name}`}
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-danger-500/15 hover:text-danger-500"
              >
                <IconX className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {(status === "failed" || comment.length > 0) ? (
        <textarea
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          disabled={!canManage || saving}
          placeholder="Add a comment about this step..."
          rows={1}
          className="mt-2 w-full resize-none rounded border border-stroke bg-surface px-2 py-1.5 text-xs text-ink placeholder:text-ink-muted outline-none focus:border-brand-300 disabled:opacity-60"
        />
      ) : null}
    </article>
  );
}

function mapGlobalResultToStatus(result: GlobalResultOption): ExecutionStatus {
  switch (result) {
    case "pass_test":
      return "passed";
    case "fail_test":
      return "failed";
    case "pause_test":
      return "blocked";
    case "block_test":
      return "blocked";
    case "not_applicable":
      return "skipped";
    case "in_progress":
      return "in_progress";
    case "not_run":
    default:
      return "not_run";
  }
}

function mapStatusToGlobalResult(status: ExecutionStatus): GlobalResultOption {
  switch (status) {
    case "passed":
      return "pass_test";
    case "failed":
      return "fail_test";
    case "blocked":
      return "block_test";
    case "skipped":
      return "not_applicable";
    case "in_progress":
      return "in_progress";
    case "not_run":
    default:
      return "not_run";
  }
}

function formatStatusLabel(status: ExecutionStatus) {
  if (status === "not_run") return "Not run";
  if (status === "in_progress") return "In progress";
  return status;
}

function buildStepStateFromDetail(detail: ExecutionDetailRecord, fallbackCount: number): ExecutionStepState[] {
  const fromResults: ExecutionStepState[] = detail.stepResults
    .sort((a, b) => a.stepIndex - b.stepIndex)
    .map((step) => ({
      status: (step.status === "passed" || step.status === "failed" ? step.status : "not_run") as StepStatus,
      comment: step.comment ?? "",
    }));

  if (fromResults.length > 0) return fromResults;
  return Array.from({ length: fallbackCount }, () => ({ status: "not_run" as const, comment: "" }));
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

