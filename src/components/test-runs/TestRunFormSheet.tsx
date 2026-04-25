"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatMessage } from "@/lib/i18n/format";
import type { TestRunPayload, TestRunRecord, TestRunStatus, TestRunType } from "./types";

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

type TestRunFormSheetProps = {
  open: boolean;
  run: TestRunRecord | null;
  projects: ProjectOption[];
  plans: TestPlanOption[];
  suites: TestSuiteOption[];
  onClose: () => void;
  onSave: (payload: TestRunPayload, runId?: string) => Promise<void>;
  onDelete?: (run: TestRunRecord) => Promise<void>;
};

type TestRunFormState = {
  projectId: string;
  testPlanId: string;
  suiteId: string;
  runType: TestRunType;
  status: TestRunStatus;
  name: string;
  environment: string;
  buildNumber: string;
  branch: string;
  commitSha: string;
  ciProvider: string;
  ciRunUrl: string;
  startedAt: string;
  finishedAt: string;
};

const emptyForm: TestRunFormState = {
  projectId: "",
  testPlanId: "",
  suiteId: "",
  runType: "manual",
  status: "queued",
  name: "",
  environment: "",
  buildNumber: "",
  branch: "",
  commitSha: "",
  ciProvider: "",
  ciRunUrl: "",
  startedAt: "",
  finishedAt: "",
};

const statusOrder: TestRunStatus[] = ["queued", "running", "completed", "canceled", "failed"];
const typeOrder: TestRunType[] = ["manual", "automated"];

function toDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TestRunFormSheet({
  open,
  run,
  projects,
  plans,
  suites,
  onClose,
  onSave,
  onDelete,
}: TestRunFormSheetProps) {
  const t = useT();
  const [form, setForm] = useState<TestRunFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (run ? t.testRuns.form.titleEdit : t.testRuns.form.titleNew),
    [run, t],
  );

  const availablePlans = useMemo(
    () => plans.filter((plan) => plan.projectId === form.projectId),
    [plans, form.projectId],
  );

  const availableSuites = useMemo(() => {
    if (form.testPlanId) {
      return suites.filter((suite) => suite.testPlanId === form.testPlanId);
    }
    if (form.projectId) {
      return suites.filter((suite) => suite.projectId === form.projectId);
    }
    return suites;
  }, [suites, form.projectId, form.testPlanId]);

  useEffect(() => {
    if (run) {
      setForm({
        projectId: run.projectId,
        testPlanId: run.testPlanId ?? "",
        suiteId: run.suiteId ?? "",
        runType: run.runType,
        status: run.status,
        name: run.name ?? "",
        environment: run.environment ?? "",
        buildNumber: run.buildNumber ?? "",
        branch: run.branch ?? "",
        commitSha: run.commitSha ?? "",
        ciProvider: run.ciProvider ?? "",
        ciRunUrl: run.ciRunUrl ?? "",
        startedAt: toDateTimeInput(run.startedAt),
        finishedAt: toDateTimeInput(run.finishedAt),
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
    setConfirmDeleteOpen(false);
  }, [run, open]);

  useEffect(() => {
    if (!form.projectId) {
      if (form.testPlanId || form.suiteId) {
        setForm((prev) => ({ ...prev, testPlanId: "", suiteId: "" }));
      }
      return;
    }
    if (form.testPlanId && !availablePlans.some((plan) => plan.id === form.testPlanId)) {
      setForm((prev) => ({ ...prev, testPlanId: "", suiteId: "" }));
      return;
    }
    if (form.suiteId && !availableSuites.some((suite) => suite.id === form.suiteId)) {
      setForm((prev) => ({ ...prev, suiteId: "" }));
    }
  }, [availablePlans, availableSuites, form.projectId, form.suiteId, form.testPlanId]);

  const handleSubmit = async () => {
    if (form.startedAt && form.finishedAt && form.finishedAt < form.startedAt) {
      setError(t.testRuns.form.invalidDateRange);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: TestRunPayload = {
        projectId: form.projectId,
        testPlanId: form.testPlanId || null,
        suiteId: form.suiteId || null,
        runType: form.runType,
        status: form.status,
        name: form.name.trim() || null,
        environment: form.environment.trim() || null,
        buildNumber: form.buildNumber.trim() || null,
        branch: form.branch.trim() || null,
        commitSha: form.commitSha.trim() || null,
        ciProvider: form.ciProvider.trim() || null,
        ciRunUrl: form.ciRunUrl.trim() || null,
        startedAt: form.startedAt || null,
        finishedAt: form.finishedAt || null,
      };
      await onSave(payload, run?.id);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t.testRuns.form.couldNotSave,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!run || !onDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(run);
      setConfirmDeleteOpen(false);
      onClose();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : t.testRuns.form.couldNotDelete,
      );
    } finally {
      setDeleting(false);
    }
  };

  const isValid = form.projectId.trim() && projects.length > 0;

  return (
    <Sheet
      open={open}
      title={title}
      description={t.testRuns.form.description}
      onClose={onClose}
    >
      <div className="grid gap-4">
        <label className="text-sm font-semibold text-ink">
          {t.testRuns.form.projectLabel}
          <select
            value={form.projectId}
            onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}
            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
          >
            <option value="">{t.testRuns.form.selectProject}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.key} · {project.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            {t.testRuns.form.planLabel}
            <select
              value={form.testPlanId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, testPlanId: event.target.value, suiteId: "" }))
              }
              disabled={!form.projectId}
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink disabled:bg-surface-muted"
            >
              <option value="">{t.testRuns.form.noPlan}</option>
              {availablePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.projectKey} · {plan.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink">
            {t.testRuns.form.suiteLabel}
            <select
              value={form.suiteId}
              onChange={(event) => setForm((prev) => ({ ...prev, suiteId: event.target.value }))}
              disabled={!form.projectId}
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink disabled:bg-surface-muted"
            >
              <option value="">{t.testRuns.form.noSuite}</option>
              {availableSuites.map((suite) => (
                <option key={suite.id} value={suite.id}>
                  {suite.projectKey} · {suite.testPlanName} · {suite.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="text-sm font-semibold text-ink">
          {t.testRuns.form.nameLabel}
          <Input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder={t.testRuns.form.namePlaceholder}
            className="mt-2"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            {t.testRuns.form.runTypeLabel}
            <select
              value={form.runType}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, runType: event.target.value as TestRunType }))
              }
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
            >
              {typeOrder.map((value) => (
                <option key={value} value={value}>
                  {t.testRuns.runTypes[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink">
            {t.testRuns.form.statusLabel}
            <select
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, status: event.target.value as TestRunStatus }))
              }
              className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
            >
              {statusOrder.map((value) => (
                <option key={value} value={value}>
                  {t.testRuns.statuses[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            {t.testRuns.form.environmentLabel}
            <Input
              value={form.environment}
              onChange={(event) => setForm((prev) => ({ ...prev, environment: event.target.value }))}
              placeholder={t.testRuns.form.environmentPlaceholder}
              className="mt-2"
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            {t.testRuns.form.buildLabel}
            <Input
              value={form.buildNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, buildNumber: event.target.value }))}
              placeholder={t.testRuns.form.buildPlaceholder}
              className="mt-2"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            {t.testRuns.form.branchLabel}
            <Input
              value={form.branch}
              onChange={(event) => setForm((prev) => ({ ...prev, branch: event.target.value }))}
              placeholder={t.testRuns.form.branchPlaceholder}
              className="mt-2"
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            {t.testRuns.form.commitLabel}
            <Input
              value={form.commitSha}
              onChange={(event) => setForm((prev) => ({ ...prev, commitSha: event.target.value }))}
              placeholder={t.testRuns.form.commitPlaceholder}
              className="mt-2"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            {t.testRuns.form.ciProviderLabel}
            <Input
              value={form.ciProvider}
              onChange={(event) => setForm((prev) => ({ ...prev, ciProvider: event.target.value }))}
              placeholder={t.testRuns.form.ciProviderPlaceholder}
              className="mt-2"
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            {t.testRuns.form.ciRunUrlLabel}
            <Input
              value={form.ciRunUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, ciRunUrl: event.target.value }))}
              placeholder={t.testRuns.form.ciRunUrlPlaceholder}
              className="mt-2"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-ink">
            {t.testRuns.form.startLabel}
            <Input
              type="datetime-local"
              value={form.startedAt}
              onChange={(event) => setForm((prev) => ({ ...prev, startedAt: event.target.value }))}
              className="mt-2"
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            {t.testRuns.form.endLabel}
            <Input
              type="datetime-local"
              value={form.finishedAt}
              onChange={(event) => setForm((prev) => ({ ...prev, finishedAt: event.target.value }))}
              className="mt-2"
            />
          </label>
        </div>

        {!projects.length ? (
          <p className="rounded-lg bg-warning-500/10 px-4 py-2 text-sm text-warning-600">
            {t.testRuns.form.noProjectsWarning}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-danger-500/10 px-4 py-2 text-sm text-danger-500">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          {run && onDelete ? (
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
            {submitting ? t.testRuns.form.saving : t.testRuns.form.save}
          </Button>
        </div>
      </div>
      <ConfirmationDialog
        open={confirmDeleteOpen}
        title={formatMessage(t.testRuns.form.deleteConfirmTitle, {
          name: run?.name ?? run?.id ?? "",
        })}
        description={t.testRuns.form.deleteConfirmDescription}
        confirmText={t.common.delete}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDeleteOpen(false)}
        isConfirming={deleting}
      />
    </Sheet>
  );
}
