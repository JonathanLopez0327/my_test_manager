"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useT } from "@/lib/i18n/LocaleProvider";
import { renameClipboardFile } from "@/lib/clipboard";
import type { BugPayload, BugRecord, BugSeverity, BugStatus, BugType } from "./types";

type ProjectOption = {
  id: string;
  key: string;
  name: string;
};

type UserOption = {
  id: string;
  email: string;
  fullName: string | null;
};

type TestRunOption = {
  id: string;
  name: string | null;
  status: string;
};

type BugFormSheetProps = {
  open: boolean;
  bug: BugRecord | null;
  projects: ProjectOption[];
  users: UserOption[];
  testRuns?: TestRunOption[];
  canUploadAttachments?: boolean;
  onClose: () => void;
  onSave: (payload: BugPayload, bugId?: string, files?: File[]) => Promise<void>;
};

type BugFormState = {
  projectId: string;
  title: string;
  description: string;
  severity: BugSeverity;
  priority: string;
  status: BugStatus;
  type: BugType;
  assignedToId: string;
  testCaseId: string;
  testRunId: string;
  reproductionSteps: string;
  expectedResult: string;
  actualResult: string;
  environment: string;
  tags: string[];
};

const emptyForm: BugFormState = {
  projectId: "",
  title: "",
  description: "",
  severity: "medium",
  priority: "3",
  status: "open",
  type: "bug",
  assignedToId: "",
  testCaseId: "",
  testRunId: "",
  reproductionSteps: "",
  expectedResult: "",
  actualResult: "",
  environment: "",
  tags: [],
};

const severityOrder: BugSeverity[] = ["critical", "high", "medium", "low"];
const statusOrder: BugStatus[] = ["open", "in_progress", "resolved", "verified", "closed", "reopened"];
const typeOrder: BugType[] = ["bug", "enhancement", "task"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BugFormSheet({
  open,
  bug,
  projects,
  users,
  testRuns = [],
  canUploadAttachments = false,
  onClose,
  onSave,
}: BugFormSheetProps) {
  const t = useT();
  const [form, setForm] = useState<BugFormState>(emptyForm);
  const [currentTag, setCurrentTag] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const title = useMemo(
    () => (bug ? t.bugs.form.titleEdit : t.bugs.form.titleNew),
    [bug, t],
  );

  useEffect(() => {
    if (bug) {
      setForm({
        projectId: bug.projectId,
        title: bug.title,
        description: bug.description ?? "",
        severity: bug.severity,
        priority: String(bug.priority ?? 3),
        status: bug.status,
        type: bug.type,
        assignedToId: bug.assignedToId ?? "",
        testCaseId: bug.testCaseId ?? "",
        testRunId: bug.testRunId ?? "",
        reproductionSteps: bug.reproductionSteps ?? "",
        expectedResult: bug.expectedResult ?? "",
        actualResult: bug.actualResult ?? "",
        environment: bug.environment ?? "",
        tags: bug.tags ?? [],
      });
    } else {
      setForm(emptyForm);
    }
    setCurrentTag("");
    setAttachmentFiles([]);
    setError(null);
  }, [bug, open]);

  useEffect(() => {
    if (!open || bug || !canUploadAttachments) return;

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i += 1) {
        const entry = items[i];
        if (entry.kind === "file" && entry.type.startsWith("image/")) {
          const file = entry.getAsFile();
          if (file) imageFiles.push(renameClipboardFile(file));
        }
      }
      if (imageFiles.length === 0) return;
      event.preventDefault();
      setAttachmentFiles((prev) => [...prev, ...imageFiles]);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [open, bug, canUploadAttachments]);

  const handleAddTag = () => {
    const value = currentTag.trim();
    if (value && !form.tags.includes(value)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, value] }));
      setCurrentTag("");
    }
  };

  const handleTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddTag();
    }
  };

  const removeTag = (tagToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: BugPayload = {
        projectId: form.projectId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        severity: form.severity,
        priority: Number.isFinite(Number(form.priority)) ? Number(form.priority) : 3,
        status: form.status,
        type: form.type,
        assignedToId: form.assignedToId || null,
        testCaseId: form.testCaseId || null,
        testRunId: form.testRunId || null,
        reproductionSteps: form.reproductionSteps.trim() || null,
        expectedResult: form.expectedResult.trim() || null,
        actualResult: form.actualResult.trim() || null,
        environment: form.environment.trim() || null,
        tags: form.tags,
      };
      await onSave(payload, bug?.id, !bug ? attachmentFiles : []);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t.bugs.form.couldNotSave,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = form.projectId.trim() && form.title.trim();

  return (
    <Sheet
      open={open}
      title={title}
      description={t.bugs.form.description}
      onClose={onClose}
    >
      <div className="grid gap-4">
        <label className="text-sm font-semibold text-ink">
          {t.bugs.form.projectLabel}
          <select
            value={form.projectId}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, projectId: event.target.value }))
            }
            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
            disabled={!!bug}
          >
            <option value="">{t.bugs.form.selectProject}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.key} &middot; {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-ink">
          {t.bugs.form.titleLabel}
          <Input
            value={form.title}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder={t.bugs.form.titlePlaceholder}
            className="mt-2"
          />
        </label>

        <label className="text-sm font-semibold text-ink">
          {t.bugs.form.descriptionLabel}
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder={t.bugs.form.descriptionPlaceholder}
            className="mt-2 min-h-[88px] w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-ink">
            {t.bugs.form.severityLabel}
            <select
              value={form.severity}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  severity: event.target.value as BugSeverity,
                }))
              }
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
            >
              {severityOrder.map((value) => (
                <option key={value} value={value}>
                  {t.bugs.severities[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-ink">
            {t.bugs.form.priorityLabel}
            <Input
              type="number"
              min={1}
              max={5}
              value={form.priority}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, priority: event.target.value }))
              }
              className="mt-2"
            />
          </label>

          <label className="text-sm font-semibold text-ink">
            {t.bugs.form.typeLabel}
            <select
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  type: event.target.value as BugType,
                }))
              }
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
            >
              {typeOrder.map((value) => (
                <option key={value} value={value}>
                  {t.bugs.types[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            {t.bugs.form.statusLabel}
            <select
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  status: event.target.value as BugStatus,
                }))
              }
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
            >
              {statusOrder.map((value) => (
                <option key={value} value={value}>
                  {t.bugs.statuses[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-ink">
            {t.bugs.form.assignedLabel}
            <select
              value={form.assignedToId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, assignedToId: event.target.value }))
              }
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
            >
              <option value="">{t.bugs.form.unassigned}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName || user.email}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="text-sm font-semibold text-ink">
          {t.bugs.form.testRunLabel}
          <select
            value={form.testRunId}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, testRunId: event.target.value }))
            }
            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
          >
            <option value="">{t.bugs.form.testRunNone}</option>
            {testRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {run.name || run.id}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-ink">
          {t.bugs.form.reproductionLabel}
          <textarea
            value={form.reproductionSteps}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, reproductionSteps: event.target.value }))
            }
            placeholder={t.bugs.form.reproductionPlaceholder}
            className="mt-2 min-h-[88px] w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            {t.bugs.form.expectedLabel}
            <textarea
              value={form.expectedResult}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, expectedResult: event.target.value }))
              }
              placeholder={t.bugs.form.expectedPlaceholder}
              className="mt-2 min-h-[60px] w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="text-sm font-semibold text-ink">
            {t.bugs.form.actualLabel}
            <textarea
              value={form.actualResult}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, actualResult: event.target.value }))
              }
              placeholder={t.bugs.form.actualPlaceholder}
              className="mt-2 min-h-[60px] w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>

        <label className="text-sm font-semibold text-ink">
          {t.bugs.form.environmentLabel}
          <Input
            value={form.environment}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, environment: event.target.value }))
            }
            placeholder={t.bugs.form.environmentPlaceholder}
            className="mt-2"
          />
        </label>

        <div className="grid gap-2">
          <label className="text-sm font-semibold text-ink">{t.bugs.form.tagsLabel}</label>
          <div className="flex flex-wrap gap-2">
            {form.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 text-stone-400 hover:text-danger-500"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <Input
            value={currentTag}
            onChange={(e) => setCurrentTag(e.target.value)}
            onBlur={handleAddTag}
            placeholder={t.bugs.form.tagsPlaceholder}
            onKeyDown={handleTagKeyDown}
            className="mt-1"
          />
        </div>

        {!bug && canUploadAttachments ? (
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-ink">{t.bugs.form.attachmentsLabel}</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => {
                const newFiles = Array.from(event.target.files ?? []);
                setAttachmentFiles((prev) => [...prev, ...newFiles]);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-full rounded-lg border border-dashed border-stroke bg-surface-elevated dark:bg-surface-muted px-4 text-sm text-ink-muted hover:border-brand-300 hover:text-ink transition"
            >
              {t.bugs.form.browseFiles}
            </button>
            <p className="text-xs text-ink-muted">{t.bugs.form.pasteHint}</p>
            {attachmentFiles.length > 0 && (
              <ul className="grid gap-1">
                {attachmentFiles.map((file, idx) => (
                  <li
                    key={`${file.name}-${idx}`}
                    className="flex items-center gap-2 rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 py-2 text-sm"
                  >
                    <span className="truncate flex-1 text-ink">{file.name}</span>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="shrink-0 ml-1 text-ink-muted hover:text-danger-500 transition"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {!projects.length ? (
          <p className="rounded-lg bg-warning-500/10 px-4 py-2 text-sm text-warning-600">
            {t.bugs.form.noProjectsWarning}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-danger-500/10 px-4 py-2 text-sm text-danger-500">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !isValid}>
            {submitting ? t.bugs.form.saving : t.bugs.form.save}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
