"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
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

type BugFormSheetProps = {
  open: boolean;
  bug: BugRecord | null;
  projects: ProjectOption[];
  users: UserOption[];
  onClose: () => void;
  onSave: (payload: BugPayload, bugId?: string) => Promise<void>;
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
  reproductionSteps: "",
  expectedResult: "",
  actualResult: "",
  environment: "",
  tags: [],
};

const severityOptions: Array<{ value: BugSeverity; label: string }> = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const statusOptions: Array<{ value: BugStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "verified", label: "Verified" },
  { value: "closed", label: "Closed" },
  { value: "reopened", label: "Reopened" },
];

const typeOptions: Array<{ value: BugType; label: string }> = [
  { value: "bug", label: "Bug" },
  { value: "enhancement", label: "Enhancement" },
  { value: "task", label: "Task" },
];

export function BugFormSheet({
  open,
  bug,
  projects,
  users,
  onClose,
  onSave,
}: BugFormSheetProps) {
  const [form, setForm] = useState<BugFormState>(emptyForm);
  const [currentTag, setCurrentTag] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => (bug ? "Edit Bug" : "New Bug"), [bug]);

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
    setError(null);
  }, [bug, open]);

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
        reproductionSteps: form.reproductionSteps.trim() || null,
        expectedResult: form.expectedResult.trim() || null,
        actualResult: form.actualResult.trim() || null,
        environment: form.environment.trim() || null,
        tags: form.tags,
      };
      await onSave(payload, bug?.id);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not save bug.",
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
      description="Define the details of the bug report."
      onClose={onClose}
    >
      <div className="grid gap-4">
        <label className="text-sm font-semibold text-ink">
          Project
          <select
            value={form.projectId}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, projectId: event.target.value }))
            }
            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
            disabled={!!bug}
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.key} &middot; {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-ink">
          Title
          <Input
            value={form.title}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="Brief description of the bug"
            className="mt-2"
          />
        </label>

        <label className="text-sm font-semibold text-ink">
          Description
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="Detailed description of the issue"
            className="mt-2 min-h-[88px] w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-ink">
            Severity
            <select
              value={form.severity}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  severity: event.target.value as BugSeverity,
                }))
              }
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
            >
              {severityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-ink">
            Priority
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
            Type
            <select
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  type: event.target.value as BugType,
                }))
              }
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            Status
            <select
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  status: event.target.value as BugStatus,
                }))
              }
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-ink">
            Assigned To
            <select
              value={form.assignedToId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, assignedToId: event.target.value }))
              }
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName || user.email}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="text-sm font-semibold text-ink">
          Reproduction Steps
          <textarea
            value={form.reproductionSteps}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, reproductionSteps: event.target.value }))
            }
            placeholder="Steps to reproduce the issue"
            className="mt-2 min-h-[88px] w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            Expected Result
            <textarea
              value={form.expectedResult}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, expectedResult: event.target.value }))
              }
              placeholder="What should happen"
              className="mt-2 min-h-[60px] w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="text-sm font-semibold text-ink">
            Actual Result
            <textarea
              value={form.actualResult}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, actualResult: event.target.value }))
              }
              placeholder="What actually happened"
              className="mt-2 min-h-[60px] w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>

        <label className="text-sm font-semibold text-ink">
          Environment
          <Input
            value={form.environment}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, environment: event.target.value }))
            }
            placeholder="e.g. Chrome 120, Windows 11, Production"
            className="mt-2"
          />
        </label>

        <div className="grid gap-2">
          <label className="text-sm font-semibold text-ink">Tags</label>
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
            placeholder="Type a tag and press Enter"
            onKeyDown={handleTagKeyDown}
            className="mt-1"
          />
        </div>

        {!projects.length ? (
          <p className="rounded-lg bg-warning-500/10 px-4 py-2 text-sm text-warning-600">
            You need at least one project to create bugs.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-danger-500/10 px-4 py-2 text-sm text-danger-500">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !isValid}>
            {submitting ? "Saving..." : "Save Bug"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
