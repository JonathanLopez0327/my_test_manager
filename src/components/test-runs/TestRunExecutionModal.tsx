"use client";

import { useEffect, useId, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { IconAlert, IconCheck, IconClipboard, IconDocument, IconPlay } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

type RunItemStatus = "passed" | "failed" | "skipped" | "blocked" | "not_run";
export type ExecutionStatus = "passed" | "failed" | "skipped" | "blocked";

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

export type ExecutionStepSnapshot = {
  status: RunItemStatus;
  notes: string;
  actualResult: string;
};

type ExecutionSavePayload = {
  status: ExecutionStatus;
  runNotes: string;
  activeStepIndex: number;
  stepState: ExecutionStepSnapshot[];
  generalFiles: File[];
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
  kind?: "execution_state" | "execution_evidence";
  scope?: "general" | "step";
  stepIndex?: number;
  snapshot?: {
    runNotes?: string;
    activeStepIndex?: number;
    steps?: ExecutionStepSnapshot[];
  };
};

const statusTone: Record<RunItemStatus, "success" | "danger" | "warning" | "neutral"> = {
  passed: "success",
  failed: "danger",
  blocked: "warning",
  skipped: "neutral",
  not_run: "neutral",
};

const compactStatusClass: Record<RunItemStatus, string> = {
  passed: "border-success-500/45 bg-success-500/15 text-success-500",
  failed: "border-danger-500/45 bg-danger-500/15 text-danger-500",
  blocked: "border-warning-500/45 bg-warning-500/15 text-warning-500",
  skipped: "border-stroke-strong bg-surface-muted text-ink-soft",
  not_run: "border-stroke bg-surface text-ink-muted",
};

// Runner guiado de ejecución para test cases dentro de test-runs workspace.
// Prioriza la ejecución por pasos y guarda estado + notas + evidencias.
// Persiste detalles de paso en metadata sin requerir migración de DB.
export function TestRunExecutionModal({
  open,
  runId,
  item,
  canManage,
  onClose,
  onLoadArtifacts,
  onSave,
}: TestRunExecutionModalProps) {
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>("passed");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [runNotes, setRunNotes] = useState("");
  const [stepState, setStepState] = useState<ExecutionStepSnapshot[]>([]);

  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [artifactsError, setArtifactsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generalExisting, setGeneralExisting] = useState<ExecutionArtifactRecord[]>([]);
  const [stepExisting, setStepExisting] = useState<Record<number, ExecutionArtifactRecord[]>>({});
  const [artifactReloadKey, setArtifactReloadKey] = useState(0);
  const [generalDraft, setGeneralDraft] = useState<File[]>([]);
  const [stepDraft, setStepDraft] = useState<Record<number, File[]>>({});
  const [fileError, setFileError] = useState<string | null>(null);

  const parsedSteps = useMemo(() => parseSteps(item?.testCase.style, item?.testCase.steps), [item?.testCase.steps, item?.testCase.style]);
  const stepCount = parsedSteps.length;
  const progressLabel = stepCount === 0 ? "No steps" : `Step ${Math.min(activeStepIndex + 1, stepCount)} of ${stepCount}`;
  const progressPercent = stepCount === 0 ? 0 : Math.min(100, Math.round(((activeStepIndex + 1) / stepCount) * 100));

  const hasChanges = useMemo(() => {
    if (!item) return false;
    const hasFiles =
      generalDraft.length > 0 ||
      Object.values(stepDraft).some((files) => files.length > 0);
    const baseStatus = normalizeStatus(item.status);
    const hasStepChanges = stepState.some((step) => step.status !== "not_run" || step.notes.trim() || step.actualResult.trim());
    return hasFiles || hasStepChanges || runNotes.trim().length > 0 || executionStatus !== baseStatus;
  }, [executionStatus, generalDraft, item, runNotes, stepDraft, stepState]);

  useEffect(() => {
    if (!open || !item) return;
    setExecutionStatus(normalizeStatus(item.status));
    setGeneralDraft([]);
    setStepDraft({});
    setFileError(null);
    setSaveError(null);
    setRunNotes("");
    setActiveStepIndex(0);
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
        const nextGeneral: ExecutionArtifactRecord[] = [];
        const nextStep: Record<number, ExecutionArtifactRecord[]> = {};
        let snapshot: ExecutionArtifactMeta["snapshot"] | null = null;

        records.filter(isImageArtifactOrState).forEach((artifact) => {
          const meta = parseExecutionArtifactMeta(artifact.metadata);

          if (meta.kind === "execution_state") {
            if (!snapshot) snapshot = meta.snapshot ?? null;
            return;
          }

          if (meta.scope === "step" && Number.isInteger(meta.stepIndex) && (meta.stepIndex ?? -1) >= 0) {
            const stepIndex = Number(meta.stepIndex);
            nextStep[stepIndex] = [...(nextStep[stepIndex] ?? []), artifact];
            return;
          }
          nextGeneral.push(artifact);
        });

        setGeneralExisting(nextGeneral);
        setStepExisting(nextStep);

        if (snapshot) {
          if (typeof snapshot.runNotes === "string") setRunNotes(snapshot.runNotes);
          if (typeof snapshot.activeStepIndex === "number" && snapshot.activeStepIndex >= 0) {
            setActiveStepIndex(Math.min(snapshot.activeStepIndex, Math.max(parsedSteps.length - 1, 0)));
          }
          if (Array.isArray(snapshot.steps)) {
            setStepState(mergeSnapshotSteps(parsedSteps.length, snapshot.steps));
          }
        }
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
  }, [artifactReloadKey, item, onLoadArtifacts, open, parsedSteps.length, runId]);

  const handlePersist = async (closeAfterSave: boolean) => {
    if (!canManage || !item || !hasChanges) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        status: executionStatus,
        runNotes: runNotes.trim(),
        activeStepIndex,
        stepState,
        generalFiles: generalDraft,
        stepFiles: stepDraft,
      });

      if (closeAfterSave) {
        onClose();
      } else {
        setGeneralDraft([]);
        setStepDraft({});
        setArtifactReloadKey((value) => value + 1);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save execution.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="4xl" closeOnEsc trapFocus>
      {!item ? null : (
        <div className="space-y-3">
          <header className="sticky top-0 z-20 rounded-lg border border-stroke bg-gradient-to-b from-surface-elevated via-surface to-surface px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="min-w-0">
                <p className="text-xl font-semibold tracking-tight text-ink">Execute test case</p>
                <p className="truncate text-xs uppercase tracking-[0.14em] text-ink-soft">
                  {item.testCase.externalKey ?? "No key"} · {progressLabel}
                </p>
              </div>
              <Badge tone={statusTone[executionStatus]} className="px-3 py-1.5 text-[11px] uppercase tracking-[0.12em]">
                {executionStatus}
              </Badge>
            </div>
            <div className="mt-2.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    executionStatus === "passed"
                      ? "bg-success-500/80"
                      : executionStatus === "failed"
                        ? "bg-danger-500/80"
                        : executionStatus === "blocked"
                          ? "bg-warning-500/80"
                          : "bg-brand-400/80",
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <div className="mt-3 inline-flex flex-wrap items-center gap-1 rounded-lg border border-stroke bg-surface-muted/70 p-1">
              {(["passed", "failed", "blocked", "skipped"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setExecutionStatus(status)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all",
                    executionStatus === status
                      ? cn(compactStatusClass[status], "shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]")
                      : "border-transparent bg-transparent text-ink-muted hover:border-stroke hover:bg-surface hover:text-ink",
                  )}
                  aria-label={`Set execution status ${status}`}
                >
                  {status === "passed" ? <IconCheck className="h-3.5 w-3.5" /> : null}
                  {status === "failed" ? <IconAlert className="h-3.5 w-3.5" /> : null}
                  {status === "blocked" ? <IconAlert className="h-3.5 w-3.5" /> : null}
                  {status === "skipped" ? <IconPlay className="h-3.5 w-3.5" /> : null}
                  {status}
                </button>
              ))}
            </div>
          </header>

          <div className="grid min-h-0 gap-3 md:grid-cols-[minmax(0,1fr)_340px]">
            <section className="min-h-0 rounded-lg border border-stroke-strong bg-surface/95 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]">
              <div className="flex items-center justify-between border-b border-stroke px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                  <IconPlay className="h-3.5 w-3.5" />
                  Steps
                </div>
                <span className="text-xs text-ink-muted">{stepCount} total</span>
              </div>
              <div className="max-h-[56vh] space-y-2 overflow-y-auto p-2">
                {stepCount === 0 ? (
                  <p className="px-2 py-4 text-sm text-ink-muted">No steps available for this case.</p>
                ) : (
                  parsedSteps.map((step, index) => {
                    const current = stepState[index] ?? { status: "not_run", notes: "", actualResult: "" };
                    const isActive = index === activeStepIndex;
                    return (
                      <article
                        key={`step-${index}`}
                        className={cn(
                          "relative rounded-md border px-2.5 py-2 transition-all",
                          isActive
                            ? "border-brand-300 bg-gradient-to-b from-brand-50/20 to-surface-elevated shadow-[0_0_0_1px_rgba(139,126,255,0.25)]"
                            : "border-stroke bg-surface-elevated/80 hover:border-stroke-strong",
                        )}
                        onClick={() => setActiveStepIndex(index)}
                      >
                        {isActive ? <span className="absolute left-0 top-0 h-full w-1 rounded-l-md bg-brand-400/80" /> : null}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">Step {index + 1}</p>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm font-semibold text-ink">{step.text}</p>
                            {step.expected ? (
                              <p className="mt-0.5 text-xs text-ink-muted">Expected: {step.expected}</p>
                            ) : null}
                          </div>
                          <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", compactStatusClass[current.status])}>
                            {current.status.replace("_", " ")}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          {(["not_run", "passed", "failed", "blocked", "skipped"] as const).map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setStepState((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...(next[index] ?? { notes: "", actualResult: "", status: "not_run" }), status };
                                  return next;
                                });
                              }}
                              className={cn(
                                "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-all",
                                current.status === status
                                  ? compactStatusClass[status]
                                  : "border-stroke text-ink-muted hover:border-stroke-strong hover:bg-surface-muted",
                              )}
                              aria-label={`Set step ${index + 1} status ${status}`}
                            >
                              {status.replace("_", " ")}
                            </button>
                          ))}
                        </div>

                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <label className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                              <IconClipboard className="h-3 w-3" />
                              Actual result
                            </span>
                            <textarea
                              value={current.actualResult}
                              onChange={(event) => {
                                const value = event.target.value;
                                setStepState((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...(next[index] ?? { notes: "", actualResult: "", status: "not_run" }), actualResult: value };
                                  return next;
                                });
                              }}
                              rows={2}
                              className="w-full resize-none rounded-md border border-stroke bg-surface-muted/55 px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-300 focus:ring-1 focus:ring-brand-400/50"
                              placeholder="Actual behavior"
                              onClick={(event) => event.stopPropagation()}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                              <IconDocument className="h-3 w-3" />
                              Notes
                            </span>
                            <textarea
                              value={current.notes}
                              onChange={(event) => {
                                const value = event.target.value;
                                setStepState((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...(next[index] ?? { notes: "", actualResult: "", status: "not_run" }), notes: value };
                                  return next;
                                });
                              }}
                              rows={2}
                              className="w-full resize-none rounded-md border border-stroke bg-surface-muted/55 px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-300 focus:ring-1 focus:ring-brand-400/50"
                              placeholder="Tester notes"
                              onClick={(event) => event.stopPropagation()}
                            />
                          </label>
                        </div>

                        <div className="mt-2" onClick={(event) => event.stopPropagation()}>
                          <CompactDropzone
                            label={`Attach evidence (step ${index + 1})`}
                            onFiles={(files) => {
                              setStepDraft((prev) => ({
                                ...prev,
                                [index]: [...(prev[index] ?? []), ...files],
                              }));
                            }}
                            onInvalid={() => setFileError("Only image files are allowed.")}
                            disabled={!canManage || saving}
                          />
                          <EvidenceList
                            existing={stepExisting[index] ?? []}
                            draft={stepDraft[index] ?? []}
                            onRemoveDraft={(draftIndex) => {
                              setStepDraft((prev) => ({
                                ...prev,
                                [index]: (prev[index] ?? []).filter((_, i) => i !== draftIndex),
                              }));
                            }}
                          />
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            <aside className="space-y-2 rounded-lg border border-stroke bg-surface-muted/35 p-3">
              <section className="border-b border-stroke pb-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft/90">Case</p>
                <p className="mt-1 text-sm font-semibold text-ink">{item.testCase.title}</p>
                <p className="text-xs text-ink-muted">{item.testCase.externalKey ?? "No key"}</p>
              </section>

              <section className="border-b border-stroke pb-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Preconditions</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-ink">{item.testCase.preconditions?.trim() || "No preconditions."}</p>
              </section>

              <section className="border-b border-stroke pb-2.5">
                <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  <IconDocument className="h-3 w-3" />
                  Run notes
                </p>
                <textarea
                  value={runNotes}
                  onChange={(event) => setRunNotes(event.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-md border border-stroke bg-surface-muted/60 px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-300 focus:ring-1 focus:ring-brand-400/50"
                  placeholder="Overall execution notes"
                />
              </section>

              <section className="border-b border-stroke pb-2.5">
                <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  <IconDocument className="h-3 w-3" />
                  General evidence
                </p>
                <div className="mt-1">
                  <CompactDropzone
                    label="Attach general evidence"
                    onFiles={(files) => setGeneralDraft((prev) => [...prev, ...files])}
                    onInvalid={() => setFileError("Only image files are allowed.")}
                    disabled={!canManage || saving}
                  />
                  <EvidenceList
                    existing={generalExisting}
                    draft={generalDraft}
                    onRemoveDraft={(index) => {
                      setGeneralDraft((prev) => prev.filter((_, i) => i !== index));
                    }}
                  />
                </div>
              </section>

              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Metadata</p>
                <div className="mt-1 grid gap-1 text-xs text-ink-muted">
                  <p>Current: {progressLabel}</p>
                  <p>Step notes: {stepState.filter((s) => s.notes.trim().length > 0).length}</p>
                  <p>Evidence files: {generalDraft.length + Object.values(stepDraft).reduce((sum, files) => sum + files.length, 0)}</p>
                </div>
              </section>
            </aside>
          </div>

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

          <footer className="sticky bottom-0 z-20 flex items-center justify-end gap-2 rounded-lg border border-stroke bg-gradient-to-t from-surface-elevated/95 to-surface/90 px-3 py-2.5 shadow-sm backdrop-blur">
            <Button type="button" variant="quiet" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" onClick={() => void handlePersist(false)} disabled={!canManage || saving || !hasChanges}>
              {saving ? "Saving..." : "Save progress"}
            </Button>
            <Button type="button" onClick={() => void handlePersist(true)} disabled={!canManage || saving || !hasChanges}>
              {saving ? "Saving..." : "Complete execution"}
            </Button>
          </footer>
        </div>
      )}
    </Modal>
  );
}

function CompactDropzone({
  label,
  disabled,
  onFiles,
  onInvalid,
}: {
  label: string;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  onInvalid: () => void;
}) {
  const inputId = useId();
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (list: FileList | null) => {
    const accepted = collectImageFiles(list);
    if (!accepted.ok) {
      onInvalid();
      return;
    }
    if (accepted.files.length > 0) {
      onFiles(accepted.files);
    }
  };

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setDragActive(false);
        if (disabled) return;
        handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "block cursor-pointer rounded-md border border-dashed px-2.5 py-2 text-xs transition-colors",
        disabled
          ? "cursor-not-allowed border-stroke text-ink-soft opacity-60"
          : dragActive
            ? "border-brand-300 bg-brand-50/20 text-brand-700"
            : "border-stroke-strong/70 bg-surface-muted/40 text-ink-muted hover:bg-surface-muted hover:text-ink",
      )}
    >
      <input
        id={inputId}
        type="file"
        className="sr-only"
        accept="image/*"
        multiple
        aria-label={label}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium">
          <IconDocument className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="rounded border border-stroke px-1.5 py-0.5 text-[10px] text-ink-soft">PNG/JPG/WEBP</span>
      </div>
      <p className="mt-1 text-[10px] text-ink-soft">
        Drag and drop screenshots here, or click to browse files.
      </p>
    </label>
  );
}

function EvidenceList({
  existing,
  draft,
  onRemoveDraft,
}: {
  existing: ExecutionArtifactRecord[];
  draft: File[];
  onRemoveDraft: (index: number) => void;
}) {
  if (existing.length === 0 && draft.length === 0) {
    return <p className="mt-1 text-[11px] text-ink-muted">No evidence yet.</p>;
  }

  return (
    <div className="mt-1 space-y-1">
      {existing.map((artifact) => (
        <a
          key={artifact.id}
          href={artifact.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between border border-stroke px-2 py-1 text-[11px] text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <span className="truncate pr-2">{artifact.name?.trim() || `Evidence ${artifact.id.slice(0, 8)}`}</span>
          <span>Open</span>
        </a>
      ))}
      {draft.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          className="flex items-center justify-between border border-brand-300 bg-brand-50/20 px-2 py-1 text-[11px] text-brand-700"
        >
          <span className="truncate pr-2">{file.name}</span>
          <button
            type="button"
            onClick={() => onRemoveDraft(index)}
            className="font-semibold hover:underline"
            aria-label={`Remove ${file.name}`}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

function isImageArtifactOrState(artifact: ExecutionArtifactRecord) {
  const meta = parseExecutionArtifactMeta(artifact.metadata);
  if (meta.kind === "execution_state") return true;
  const mimeType = (artifact.mimeType ?? "").toLowerCase();
  const url = artifact.url.toLowerCase();
  return mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url);
}

function parseExecutionArtifactMeta(metadata: unknown): ExecutionArtifactMeta {
  if (!metadata || typeof metadata !== "object") return {};
  const raw = metadata as Record<string, unknown>;
  const kind =
    raw.kind === "execution_state" || raw.kind === "execution_evidence"
      ? raw.kind
      : undefined;
  const scope = raw.scope === "step" || raw.scope === "general" ? raw.scope : undefined;
  const stepIndex = Number(raw.stepIndex);
  const snapshotRaw = raw.snapshot;
  const snapshot =
    snapshotRaw && typeof snapshotRaw === "object"
      ? (snapshotRaw as ExecutionArtifactMeta["snapshot"])
      : undefined;
  return {
    kind,
    scope,
    stepIndex: Number.isInteger(stepIndex) && stepIndex >= 0 ? stepIndex : undefined,
    snapshot,
  };
}

function normalizeStatus(status: RunItemStatus): ExecutionStatus {
  if (status === "passed" || status === "failed" || status === "skipped" || status === "blocked") {
    return status;
  }
  return "passed";
}

function collectImageFiles(list: FileList | null): { ok: true; files: File[] } | { ok: false } {
  if (!list) return { ok: true, files: [] };
  const files = Array.from(list);
  const onlyImages = files.every((file) => file.type.startsWith("image/"));
  if (!onlyImages) return { ok: false };
  return { ok: true, files };
}

function buildDefaultStepState(count: number): ExecutionStepSnapshot[] {
  return Array.from({ length: count }, () => ({
    status: "not_run" as const,
    notes: "",
    actualResult: "",
  }));
}

function mergeSnapshotSteps(count: number, snapshotSteps: ExecutionStepSnapshot[]): ExecutionStepSnapshot[] {
  const base = buildDefaultStepState(count);
  return base.map((step, index) => ({
    status: snapshotSteps[index]?.status ?? step.status,
    notes: snapshotSteps[index]?.notes ?? "",
    actualResult: snapshotSteps[index]?.actualResult ?? "",
  }));
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
