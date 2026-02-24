"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import type { TestSuitePayload, TestSuiteRecord } from "./types";

type TestPlanOption = {
    id: string;
    name: string;
    projectKey: string;
    projectName: string;
};

type ParentOption = {
    id: string;
    name: string;
};

type TestSuiteFormSheetProps = {
    open: boolean;
    suite: TestSuiteRecord | null;
    testPlans: TestPlanOption[];
    onClose: () => void;
    onSave: (payload: TestSuitePayload, suiteId?: string) => Promise<void>;
};

type TestSuiteFormState = {
    testPlanId: string;
    parentSuiteId: string;
    name: string;
    description: string;
    displayOrder: string;
};

const emptyForm: TestSuiteFormState = {
    testPlanId: "",
    parentSuiteId: "",
    name: "",
    description: "",
    displayOrder: "0",
};

export function TestSuiteFormSheet({
    open,
    suite,
    testPlans,
    onClose,
    onSave,
}: TestSuiteFormSheetProps) {
    const [form, setForm] = useState<TestSuiteFormState>(emptyForm);
    const [parentOptions, setParentOptions] = useState<ParentOption[]>([]);
    const [loadingParents, setLoadingParents] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const title = useMemo(
        () => (suite ? "Editar suite de prueba" : "Nueva suite de prueba"),
        [suite],
    );

    useEffect(() => {
        if (suite) {
            setForm({
                testPlanId: suite.testPlanId,
                parentSuiteId: suite.parentSuiteId ?? "",
                name: suite.name,
                description: suite.description ?? "",
                displayOrder: String(suite.displayOrder ?? 0),
            });
        } else {
            setForm(emptyForm);
        }
        setError(null);
    }, [suite, open]);

    useEffect(() => {
        if (!open || !form.testPlanId) {
            setParentOptions([]);
            return;
        }

        const fetchParents = async () => {
            setLoadingParents(true);
            try {
                const params = new URLSearchParams({
                    page: "1",
                    pageSize: "100",
                    testPlanId: form.testPlanId,
                });
                const response = await fetch(`/api/test-suites?${params.toString()}`);
                const data = (await response.json()) as {
                    items?: Array<{ id: string; name: string }>;
                    message?: string;
                };
                if (!response.ok) {
                    throw new Error(data.message || "No se pudieron cargar las suites.");
                }
                const options =
                    data.items
                        ?.filter((item) => item.id !== suite?.id)
                        .map((item) => ({ id: item.id, name: item.name })) ?? [];
                setParentOptions(options);
            } catch (fetchError) {
                setParentOptions([]);
                setError(
                    fetchError instanceof Error
                        ? fetchError.message
                        : "No se pudieron cargar las suites.",
                );
            } finally {
                setLoadingParents(false);
            }
        };

        fetchParents();
    }, [form.testPlanId, open, suite?.id]);

    useEffect(() => {
        if (!form.testPlanId) {
            if (form.parentSuiteId) {
                setForm((prev) => ({ ...prev, parentSuiteId: "" }));
            }
            return;
        }
        if (
            form.parentSuiteId &&
            !parentOptions.some((option) => option.id === form.parentSuiteId)
        ) {
            setForm((prev) => ({ ...prev, parentSuiteId: "" }));
        }
    }, [form.testPlanId, form.parentSuiteId, parentOptions]);

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const payload: TestSuitePayload = {
                testPlanId: form.testPlanId,
                parentSuiteId: form.parentSuiteId || null,
                name: form.name.trim(),
                description: form.description.trim() || null,
                displayOrder: Number.isFinite(Number(form.displayOrder))
                    ? Number(form.displayOrder)
                    : 0,
            };
            await onSave(payload, suite?.id);
            onClose();
        } catch (submitError) {
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : "No se pudo guardar la suite.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    const isValid =
        form.testPlanId.trim() && form.name.trim() && testPlans.length > 0;

    return (
        <Sheet
            open={open}
            title={title}
            description="Define el plan, jerarquía y orden de la suite."
            onClose={onClose}
        >
            <div className="grid gap-4">
                <label className="text-sm font-semibold text-ink">
                    Plan de prueba
                    <select
                        value={form.testPlanId}
                        onChange={(event) =>
                            setForm((prev) => ({
                                ...prev,
                                testPlanId: event.target.value,
                                parentSuiteId: "",
                            }))
                        }
                        className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
                    >
                        <option value="">Selecciona un plan</option>
                        {testPlans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                                {plan.projectKey} · {plan.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="text-sm font-semibold text-ink">
                    Suite padre
                    <select
                        value={form.parentSuiteId}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, parentSuiteId: event.target.value }))
                        }
                        className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
                        disabled={!form.testPlanId || loadingParents}
                    >
                        <option value="">
                            {loadingParents ? "Cargando suites..." : "Sin padre (raíz)"}
                        </option>
                        {parentOptions.map((suiteOption) => (
                            <option key={suiteOption.id} value={suiteOption.id}>
                                {suiteOption.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="text-sm font-semibold text-ink">
                    Nombre de la suite
                    <Input
                        value={form.name}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="UI Regression"
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
                    Orden de visualización
                    <Input
                        type="number"
                        min={0}
                        value={form.displayOrder}
                        onChange={(event) =>
                            setForm((prev) => ({
                                ...prev,
                                displayOrder: event.target.value,
                            }))
                        }
                        className="mt-2"
                    />
                </label>

                {!testPlans.length ? (
                    <p className="rounded-lg bg-warning-500/10 px-4 py-2 text-sm text-warning-600">
                        Necesitas al menos un plan para crear una suite.
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
                        {submitting ? "Guardando..." : "Guardar suite"}
                    </Button>
                </div>
            </div>
        </Sheet>
    );
}
