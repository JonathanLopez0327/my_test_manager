"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
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

const statusOptions: Array<{ value: TestRunStatus; label: string }> = [
    { value: "queued", label: "En cola" },
    { value: "running", label: "En ejecución" },
    { value: "completed", label: "Completado" },
    { value: "canceled", label: "Cancelado" },
    { value: "failed", label: "Fallido" },
];

const typeOptions: Array<{ value: TestRunType; label: string }> = [
    { value: "manual", label: "Manual" },
    { value: "automated", label: "Automatizado" },
];

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
}: TestRunFormSheetProps) {
    const [form, setForm] = useState<TestRunFormState>(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const title = useMemo(
        () => (run ? "Editar ejecución" : "Nueva ejecución"),
        [run],
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
    }, [run, open]);

    useEffect(() => {
        if (!form.projectId) {
            if (form.testPlanId || form.suiteId) {
                setForm((prev) => ({ ...prev, testPlanId: "", suiteId: "" }));
            }
            return;
        }
        if (
            form.testPlanId &&
            !availablePlans.some((plan) => plan.id === form.testPlanId)
        ) {
            setForm((prev) => ({ ...prev, testPlanId: "", suiteId: "" }));
            return;
        }
        if (
            form.suiteId &&
            !availableSuites.some((suite) => suite.id === form.suiteId)
        ) {
            setForm((prev) => ({ ...prev, suiteId: "" }));
        }
    }, [
        availablePlans,
        availableSuites,
        form.projectId,
        form.suiteId,
        form.testPlanId,
    ]);

    const handleSubmit = async () => {
        if (form.startedAt && form.finishedAt && form.finishedAt < form.startedAt) {
            setError("La fecha de fin debe ser posterior a la fecha de inicio.");
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
                    : "No se pudo guardar la ejecución.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    const isValid = form.projectId.trim() && projects.length > 0;

    return (
        <Sheet
            open={open}
            title={title}
            description="Define el alcance, estado y entorno de la ejecución."
            onClose={onClose}
        >
            <div className="grid gap-4">
                <label className="text-sm font-semibold text-ink">
                    Proyecto
                    <select
                        value={form.projectId}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, projectId: event.target.value }))
                        }
                        className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
                    >
                        <option value="">Selecciona un proyecto</option>
                        {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                                {project.key} · {project.name}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-semibold text-ink">
                        Plan (opcional)
                        <select
                            value={form.testPlanId}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    testPlanId: event.target.value,
                                    suiteId: "",
                                }))
                            }
                            disabled={!form.projectId}
                            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink disabled:bg-surface-muted"
                        >
                            <option value="">Sin plan</option>
                            {availablePlans.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                    {plan.projectKey} · {plan.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm font-semibold text-ink">
                        Suite (opcional)
                        <select
                            value={form.suiteId}
                            onChange={(event) =>
                                setForm((prev) => ({ ...prev, suiteId: event.target.value }))
                            }
                            disabled={!form.projectId}
                            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink disabled:bg-surface-muted"
                        >
                            <option value="">Sin suite</option>
                            {availableSuites.map((suite) => (
                                <option key={suite.id} value={suite.id}>
                                    {suite.projectKey} · {suite.testPlanName} · {suite.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <label className="text-sm font-semibold text-ink">
                    Nombre (opcional)
                    <Input
                        value={form.name}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="Regression nightly"
                        className="mt-2"
                    />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-semibold text-ink">
                        Tipo de ejecución
                        <select
                            value={form.runType}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    runType: event.target.value as TestRunType,
                                }))
                            }
                            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
                        >
                            {typeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm font-semibold text-ink">
                        Estado
                        <select
                            value={form.status}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    status: event.target.value as TestRunStatus,
                                }))
                            }
                            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
                        >
                            {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-semibold text-ink">
                        Ambiente
                        <Input
                            value={form.environment}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    environment: event.target.value,
                                }))
                            }
                            placeholder="staging"
                            className="mt-2"
                        />
                    </label>
                    <label className="text-sm font-semibold text-ink">
                        Build
                        <Input
                            value={form.buildNumber}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    buildNumber: event.target.value,
                                }))
                            }
                            placeholder="5.4.12"
                            className="mt-2"
                        />
                    </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-semibold text-ink">
                        Branch
                        <Input
                            value={form.branch}
                            onChange={(event) =>
                                setForm((prev) => ({ ...prev, branch: event.target.value }))
                            }
                            placeholder="release/5.4"
                            className="mt-2"
                        />
                    </label>
                    <label className="text-sm font-semibold text-ink">
                        Commit
                        <Input
                            value={form.commitSha}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    commitSha: event.target.value,
                                }))
                            }
                            placeholder="e7b1a9f"
                            className="mt-2"
                        />
                    </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-semibold text-ink">
                        CI Provider
                        <Input
                            value={form.ciProvider}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    ciProvider: event.target.value,
                                }))
                            }
                            placeholder="GitHub Actions"
                            className="mt-2"
                        />
                    </label>
                    <label className="text-sm font-semibold text-ink">
                        CI Run URL
                        <Input
                            value={form.ciRunUrl}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    ciRunUrl: event.target.value,
                                }))
                            }
                            placeholder="https://..."
                            className="mt-2"
                        />
                    </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-semibold text-ink">
                        Inicio
                        <Input
                            type="datetime-local"
                            value={form.startedAt}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    startedAt: event.target.value,
                                }))
                            }
                            className="mt-2"
                        />
                    </label>
                    <label className="text-sm font-semibold text-ink">
                        Fin
                        <Input
                            type="datetime-local"
                            value={form.finishedAt}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    finishedAt: event.target.value,
                                }))
                            }
                            className="mt-2"
                        />
                    </label>
                </div>

                {!projects.length ? (
                    <p className="rounded-lg bg-warning-500/10 px-4 py-2 text-sm text-warning-600">
                        Necesitas al menos un proyecto para crear runs.
                    </p>
                ) : null}

                {error ? (
                    <p className="rounded-lg bg-danger-500/10 px-4 py-2 text-sm text-danger-500">
                        {error}
                    </p>
                ) : null}

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <Button variant="ghost" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || !isValid}>
                        {submitting ? "Guardando..." : "Guardar run"}
                    </Button>
                </div>
            </div>
        </Sheet>
    );
}
