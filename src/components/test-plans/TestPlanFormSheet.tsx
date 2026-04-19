"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatMessage } from "@/lib/i18n/format";
import type { TestPlanPayload, TestPlanRecord, TestPlanStatus } from "./types";

type ProjectOption = {
  id: string;
  key: string;
  name: string;
};

type TestPlanFormSheetProps = {
  open: boolean;
  plan: TestPlanRecord | null;
  projects: ProjectOption[];
  onClose: () => void;
  onSave: (payload: TestPlanPayload, planId?: string) => Promise<void>;
  onDelete?: (plan: TestPlanRecord) => Promise<void>;
};

type TestPlanFormState = {
  projectId: string;
  name: string;
  description: string;
  status: TestPlanStatus;
  startsOn: string;
  endsOn: string;
};

const emptyForm: TestPlanFormState = {
  projectId: "",
  name: "",
  description: "",
  status: "draft",
  startsOn: "",
  endsOn: "",
};

const statusOrder: TestPlanStatus[] = ["draft", "active", "completed", "archived"];

function toDateInput(value?: string | null) {
  if (!value) return "";
  return value.split("T")[0] ?? "";
}

export function TestPlanFormSheet({
  open,
  plan,
  projects,
  onClose,
  onSave,
  onDelete,
}: TestPlanFormSheetProps) {
  const t = useT();
  const [form, setForm] = useState<TestPlanFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (plan ? t.testPlans.form.titleEdit : t.testPlans.form.titleNew),
    [plan, t],
  );

  useEffect(() => {
    if (plan) {
      setForm({
        projectId: plan.projectId,
        name: plan.name,
        description: plan.description ?? "",
        status: plan.status,
        startsOn: toDateInput(plan.startsOn),
        endsOn: toDateInput(plan.endsOn),
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
    setConfirmDeleteOpen(false);
  }, [plan, open]);

  const handleSubmit = async () => {
    if (form.startsOn && form.endsOn && form.endsOn < form.startsOn) {
      setError(t.testPlans.form.invalidDateRange);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: TestPlanPayload = {
        projectId: form.projectId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        startsOn: form.startsOn || null,
        endsOn: form.endsOn || null,
      };
      await onSave(payload, plan?.id);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t.testPlans.form.couldNotSave,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!plan || !onDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(plan);
      setConfirmDeleteOpen(false);
      onClose();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : t.testPlans.form.couldNotDelete,
      );
    } finally {
      setDeleting(false);
    }
  };

  const isValid = form.projectId.trim() && form.name.trim() && projects.length > 0;

  return (
    <Sheet
      open={open}
      title={title}
      description={t.testPlans.form.description}
      onClose={onClose}
    >
      <div className="grid gap-4">
        <label className="text-sm font-semibold text-ink">
          {t.testPlans.form.projectLabel}
          <select
            value={form.projectId}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, projectId: event.target.value }))
            }
            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
          >
            <option value="">{t.testPlans.form.selectProject}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.key} · {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-ink">
          {t.testPlans.form.nameLabel}
          <Input
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder={t.testPlans.form.namePlaceholder}
            className="mt-2"
          />
        </label>
        <label className="text-sm font-semibold text-ink">
          {t.testPlans.form.descriptionLabel}
          <Input
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder={t.testPlans.form.descriptionPlaceholder}
            className="mt-2"
          />
        </label>
        <label className="text-sm font-semibold text-ink">
          {t.testPlans.form.statusLabel}
          <select
            value={form.status}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                status: event.target.value as TestPlanStatus,
              }))
            }
            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
          >
            {statusOrder.map((value) => (
              <option key={value} value={value}>
                {t.testPlans.statuses[value]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            {t.testPlans.form.startLabel}
            <Input
              type="date"
              value={form.startsOn}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, startsOn: event.target.value }))
              }
              className="mt-2"
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            {t.testPlans.form.endLabel}
            <Input
              type="date"
              value={form.endsOn}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, endsOn: event.target.value }))
              }
              className="mt-2"
            />
          </label>
        </div>
        {!projects.length ? (
          <p className="rounded-lg bg-warning-500/10 px-4 py-2 text-sm text-warning-600">
            {t.testPlans.form.noProjectsWarning}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-danger-500/10 px-4 py-2 text-sm text-danger-500">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          {plan && onDelete ? (
            <Button
              variant="critical"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={submitting || deleting}
              className="mr-auto"
            >
              {t.common.delete}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !isValid}>
            {submitting ? t.testPlans.form.saving : t.testPlans.form.save}
          </Button>
        </div>
      </div>
      <ConfirmationDialog
        open={confirmDeleteOpen}
        title={formatMessage(t.testPlans.form.deleteConfirmTitle, { name: plan?.name ?? "" })}
        description={t.testPlans.form.deleteConfirmDescription}
        confirmText={t.common.delete}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDeleteOpen(false)}
        isConfirming={deleting}
      />
    </Sheet>
  );
}
