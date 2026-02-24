"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
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

const statusOptions: Array<{ value: TestPlanStatus; label: string }> = [
    { value: "draft", label: "Borrador" },
    { value: "active", label: "Activo" },
    { value: "completed", label: "Completado" },
    { value: "archived", label: "Archivado" },
];

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
}: TestPlanFormSheetProps) {
    const [form, setForm] = useState<TestPlanFormState>(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const title = useMemo(
        () => (plan ? "Editar plan de prueba" : "Nuevo plan de prueba"),
        [plan],
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
    }, [plan, open]);

    const handleSubmit = async () => {
        if (form.startsOn && form.endsOn && form.endsOn < form.startsOn) {
            setError("La fecha de fin debe ser posterior a la fecha de inicio.");
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
                    : "No se pudo guardar el plan.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    const isValid =
        form.projectId.trim() && form.name.trim() && projects.length > 0;

    return (
        <Sheet
            open={open}
            title={title}
            description="Define el proyecto, estado y fechas del plan."
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
                <label className="text-sm font-semibold text-ink">
                    Nombre del plan
                    <Input
                        value={form.name}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="Release candidate 5.2"
                        className="mt-2"
                    />
                </label>
                <label className="text-sm font-semibold text-ink">
                    Descripción
                    <Input
                        value={form.description}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                        placeholder="Opcional"
                        className="mt-2"
                    />
                </label>
                <label className="text-sm font-semibold text-ink">
                    Estado
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
                        {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-ink">
                        Inicio
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
                        Fin
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
                        Necesitas al menos un proyecto para crear un plan.
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
                        {submitting ? "Guardando..." : "Guardar plan"}
                    </Button>
                </div>
            </div>
        </Sheet>
    );
}
