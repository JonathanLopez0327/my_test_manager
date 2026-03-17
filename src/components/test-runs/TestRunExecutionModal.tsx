"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

export type ExecutionStatus = "passed" | "failed" | "skipped";

export type ExecutionItemRecord = {
  id: string;
  status: "passed" | "failed" | "skipped" | "blocked" | "not_run";
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

type ExecutionSavePayload = {
  status: ExecutionStatus;
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
  scope?: "general" | "step";
  stepIndex?: number;
};

// Modal de ejecución para test run items.
// Muestra contexto del caso (pre-condición y pasos) y permite guardar
// estado + evidencias por paso/general sin cambiar el esquema de DB.
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
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [artifactsError, setArtifactsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generalExisting, setGeneralExisting] = useState<ExecutionArtifactRecord[]>([]);
  const [stepExisting, setStepExisting] = useState<Record<number, ExecutionArtifactRecord[]>>({});
  const [generalDraft, setGeneralDraft] = useState<File[]>([]);
  const [stepDraft, setStepDraft] = useState<Record<number, File[]>>({});
  const [fileError, setFileError] = useState<string | null>(null);

  const parsedSteps = useMemo(() => parseSteps(item?.testCase.style, item?.testCase.steps), [item?.testCase.steps, item?.testCase.style]);
  const hasChanges = useMemo(() => {
    if (!item) return false;
    const hasFiles =
      generalDraft.length > 0 ||
      Object.values(stepDraft).some((files) => files.length > 0);
    return hasFiles || executionStatus !== normalizeStatus(item.status);
  }, [executionStatus, generalDraft, item, stepDraft]);

  useEffect(() => {
    if (!open || !item) return;
    setExecutionStatus(normalizeStatus(item.status));
    setGeneralDraft([]);
    setStepDraft({});
    setFileError(null);
    setSaveError(null);
  }, [item, open]);

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

        records.filter(isImageArtifact).forEach((artifact) => {
          const meta = parseExecutionArtifactMeta(artifact.metadata);
          if (meta.scope === "step" && Number.isInteger(meta.stepIndex) && (meta.stepIndex ?? -1) >= 0) {
            const stepIndex = Number(meta.stepIndex);
            nextStep[stepIndex] = [...(nextStep[stepIndex] ?? []), artifact];
            return;
          }
          nextGeneral.push(artifact);
        });

        setGeneralExisting(nextGeneral);
        setStepExisting(nextStep);
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

  const onSelectGeneral = (event: ChangeEvent<HTMLInputElement>) => {
    const accepted = collectImageFiles(event.target.files);
    if (!accepted.ok) {
      setFileError("Only image files are allowed.");
      event.target.value = "";
      return;
    }
    setFileError(null);
    setGeneralDraft((prev) => [...prev, ...accepted.files]);
    event.target.value = "";
  };

  const onSelectStepFiles = (stepIndex: number, event: ChangeEvent<HTMLInputElement>) => {
    const accepted = collectImageFiles(event.target.files);
    if (!accepted.ok) {
      setFileError("Only image files are allowed.");
      event.target.value = "";
      return;
    }
    setFileError(null);
    setStepDraft((prev) => ({
      ...prev,
      [stepIndex]: [...(prev[stepIndex] ?? []), ...accepted.files],
    }));
    event.target.value = "";
  };

  const handleSave = async () => {
    if (!canManage || !item || !hasChanges) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        status: executionStatus,
        generalFiles: generalDraft,
        stepFiles: stepDraft,
      });
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save execution.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Execute test case"
      description="Update execution status and attach image evidence."
      size="2xl"
      closeOnEsc
      trapFocus
    >
      {!item ? null : (
        <div className="space-y-4">
          <section className="rounded-lg border border-stroke bg-surface p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Case</p>
            <p className="mt-1 text-base font-semibold text-ink">{item.testCase.title}</p>
            <p className="text-sm text-ink-muted">{item.testCase.externalKey ?? "No key"}</p>
          </section>

          <section className="rounded-lg border border-stroke bg-surface p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Pre-condition</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
              {item.testCase.preconditions?.trim() || "No pre-condition."}
            </p>
          </section>

          <section className="rounded-lg border border-stroke bg-surface p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Execution status</p>
              <Badge tone={executionStatus === "failed" ? "danger" : executionStatus === "passed" ? "success" : "neutral"}>
                {executionStatus}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["passed", "failed", "skipped"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setExecutionStatus(status)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    executionStatus === status
                      ? "border-brand-300 bg-brand-50 text-brand-700"
                      : "border-stroke text-ink-muted hover:bg-surface-muted hover:text-ink",
                  )}
                  aria-label={`Set status ${status}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-stroke bg-surface p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">General evidence</p>
            <p className="mt-1 text-xs text-ink-muted">Attach screenshots for the complete execution.</p>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onSelectGeneral}
                disabled={!canManage || saving}
                aria-label="Add general evidence images"
                className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border file:border-stroke file:bg-surface-elevated file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink-muted hover:file:bg-surface-muted"
              />
            </div>
            <EvidenceList existing={generalExisting} draft={generalDraft} onRemoveDraft={(index) => {
              setGeneralDraft((prev) => prev.filter((_, i) => i !== index));
            }} />
          </section>

          <section className="rounded-lg border border-stroke bg-surface p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Steps</p>
            <div className="mt-3 h-72 overflow-y-auto pr-1">
              {parsedSteps.length === 0 ? (
                <p className="text-sm text-ink-muted">No steps available for this case.</p>
              ) : (
                <div className="space-y-3">
                  {parsedSteps.map((step, index) => (
                    <article key={`step-${index}`} className="rounded-lg border border-stroke bg-surface-elevated p-2.5">
                      <p className="text-sm font-semibold text-ink">Step {index + 1}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{step.text}</p>
                      {step.expected ? (
                        <p className="mt-1 text-xs text-ink-muted">Expected: {step.expected}</p>
                      ) : null}
                      <div className="mt-2">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) => onSelectStepFiles(index, event)}
                          disabled={!canManage || saving}
                          aria-label={`Add evidence images for step ${index + 1}`}
                          className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border file:border-stroke file:bg-surface-elevated file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink-muted hover:file:bg-surface-muted"
                        />
                      </div>
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
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          {loadingArtifacts ? <p className="text-sm text-ink-muted">Loading evidence...</p> : null}
          {artifactsError ? (
            <div className="rounded-lg border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-600">
              {artifactsError}
            </div>
          ) : null}
          {fileError ? (
            <div className="rounded-lg border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-600">
              {fileError}
            </div>
          ) : null}
          {saveError ? (
            <div className="rounded-lg border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-600">
              {saveError}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-stroke pt-4">
            <Button type="button" variant="quiet" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canManage || saving || !hasChanges}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
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
    return <p className="mt-2 text-xs text-ink-muted">No evidence files yet.</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {existing.map((artifact) => (
        <a
          key={artifact.id}
          href={artifact.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-md border border-stroke px-2.5 py-1.5 text-xs text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <span className="truncate pr-2">{artifact.name?.trim() || `Evidence ${artifact.id.slice(0, 8)}`}</span>
          <span>Open</span>
        </a>
      ))}
      {draft.map((file, index) => (
        <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border border-brand-300 bg-brand-50/20 px-2.5 py-1.5 text-xs text-brand-700">
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

function isImageArtifact(artifact: ExecutionArtifactRecord) {
  const mimeType = (artifact.mimeType ?? "").toLowerCase();
  const url = artifact.url.toLowerCase();
  return mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url);
}

function parseExecutionArtifactMeta(metadata: unknown): ExecutionArtifactMeta {
  if (!metadata || typeof metadata !== "object") return {};
  const raw = metadata as Record<string, unknown>;
  const scope = raw.scope === "step" || raw.scope === "general" ? raw.scope : undefined;
  const stepIndex = Number(raw.stepIndex);
  return {
    scope,
    stepIndex: Number.isInteger(stepIndex) && stepIndex >= 0 ? stepIndex : undefined,
  };
}

function normalizeStatus(status: ExecutionItemRecord["status"]): ExecutionStatus {
  if (status === "passed" || status === "failed" || status === "skipped") return status;
  return "passed";
}

function collectImageFiles(list: FileList | null): { ok: true; files: File[] } | { ok: false } {
  if (!list) return { ok: true, files: [] };
  const files = Array.from(list);
  const onlyImages = files.every((file) => file.type.startsWith("image/"));
  if (!onlyImages) return { ok: false };
  return { ok: true, files };
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
    return [
      {
        text: `${method} ${endpoint}`,
        expected: `Expected status ${status}`,
      },
    ];
  }

  if (Array.isArray(steps)) {
    return steps
      .map((entry) => (typeof entry === "string" ? { text: entry } : null))
      .filter((entry): entry is ParsedStep => Boolean(entry?.text?.trim()));
  }

  return [];
}
