"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import type {
    TestCasePayload,
    TestCaseRecord,
    TestCaseStatus,
} from "./types";

type TestSuiteOption = {
    id: string;
    name: string;
    testPlanName: string;
    projectKey: string;
    projectName: string;
};

type TestCaseFormSheetProps = {
    open: boolean;
    testCase: TestCaseRecord | null;
    suites: TestSuiteOption[];
    onClose: () => void;
    onSave: (payload: TestCasePayload, testCaseId?: string) => Promise<void>;
};

type TestCaseFormState = {
    suiteId: string;
    title: string;
    description: string;
    preconditions: string;
    stepsText: string;
    status: TestCaseStatus;
    priority: string;
    isAutomated: boolean;
    automationType: string;
    automationRef: string;
};

const emptyForm: TestCaseFormState = {
    suiteId: "",
    title: "",
    description: "",
    preconditions: "",
    stepsText: "",
    status: "draft",
    priority: "3",
    isAutomated: false,
    automationType: "",
    automationRef: "",
};

const statusOptions: Array<{ value: TestCaseStatus; label: string }> = [
    { value: "draft", label: "Borrador" },
    { value: "ready", label: "Listo" },
    { value: "deprecated", label: "Deprecado" },
];

export function TestCaseFormSheet({
    open,
    testCase,
    suites,
    onClose,
    onSave,
}: TestCaseFormSheetProps) {
    const [form, setForm] = useState<TestCaseFormState>(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const title = useMemo(
        () => (testCase ? "Editar caso de prueba" : "Nuevo caso de prueba"),
        [testCase],
    );

    useEffect(() => {
        if (testCase) {
            setForm({
                suiteId: testCase.suiteId,
                title: testCase.title,
                description: testCase.description ?? "",
                preconditions: testCase.preconditions ?? "",
                stepsText: Array.isArray(testCase.steps)
                    ? testCase.steps.join("\n")
                    : "",
                status: testCase.status,
                priority: String(testCase.priority ?? 3),
                isAutomated: testCase.isAutomated,
                automationType: testCase.automationType ?? "",
                automationRef: testCase.automationRef ?? "",
            });
        } else {
            setForm(emptyForm);
        }
        setError(null);
    }, [testCase, open]);

    useEffect(() => {
        if (!form.isAutomated) {
            if (form.automationType || form.automationRef) {
                setForm((prev) => ({
                    ...prev,
                    automationType: "",
                    automationRef: "",
                }));
            }
        }
    }, [form.isAutomated, form.automationType, form.automationRef]);

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const steps = form.stepsText
                .split("\n")
                .map((step) => step.trim())
                .filter(Boolean);
            const payload: TestCasePayload = {
                suiteId: form.suiteId,
                title: form.title.trim(),
                description: form.description.trim() || null,
                preconditions: form.preconditions.trim() || null,
                steps,
                status: form.status,
                priority: Number.isFinite(Number(form.priority))
                    ? Number(form.priority)
                    : 3,
                isAutomated: form.isAutomated,
                automationType: form.isAutomated
                    ? form.automationType.trim() || null
                    : null,
                automationRef: form.isAutomated
                    ? form.automationRef.trim() || null
                    : null,
            };
            await onSave(payload, testCase?.id);
            onClose();
        } catch (submitError) {
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : "No se pudo guardar el caso.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    const isValid = form.suiteId.trim() && form.title.trim() && suites.length > 0;

    return (
        <Sheet
            open={open}
            title={title}
            description="Define el detalle, estado y pasos del caso."
            onClose={onClose}
        >
            <div className="grid gap-4">
                <label className="text-sm font-semibold text-ink">
                    Suite de prueba
                    <select
                        value={form.suiteId}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, suiteId: event.target.value }))
                        }
                        className="mt-2 h-10 w-full rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
                    >
                        <option value="">Selecciona una suite</option>
                        {suites.map((suite) => (
                            <option key={suite.id} value={suite.id}>
                                {suite.projectKey} · {suite.testPlanName} · {suite.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="text-sm font-semibold text-ink">
                    Título del caso
                    <Input
                        value={form.title}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, title: event.target.value }))
                        }
                        placeholder="Validar login con 2FA"
                        className="mt-2"
                    />
                </label>

                <label className="text-sm font-semibold text-ink">
                    Descripción
                    <textarea
                        value={form.description}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                        placeholder="Contexto del caso"
                        className="mt-2 min-h-[88px] w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                    />
                </label>

                <label className="text-sm font-semibold text-ink">
                    Precondiciones
                    <textarea
                        value={form.preconditions}
                        onChange={(event) =>
                            setForm((prev) => ({
                                ...prev,
                                preconditions: event.target.value,
                            }))
                        }
                        placeholder="Datos o estados necesarios antes de ejecutar"
                        className="mt-2 min-h-[88px] w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                    />
                </label>

                <label className="text-sm font-semibold text-ink">
                    Pasos (uno por línea)
                    <textarea
                        value={form.stepsText}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, stepsText: event.target.value }))
                        }
                        placeholder={"1. Abrir la app\n2. Completar credenciales"}
                        className="mt-2 min-h-[120px] w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                    />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-semibold text-ink">
                        Estado
                        <select
                            value={form.status}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    status: event.target.value as TestCaseStatus,
                                }))
                            }
                            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
                        >
                            {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="text-sm font-semibold text-ink">
                        Prioridad
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
                </div>

                <label className="flex items-center gap-3 text-sm font-semibold text-ink">
                    <input
                        type="checkbox"
                        checked={form.isAutomated}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, isAutomated: event.target.checked }))
                        }
                        className="h-4 w-4 rounded border-stroke text-brand-600 focus:ring-brand-200"
                    />
                    Caso automatizado
                </label>

                {form.isAutomated ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="text-sm font-semibold text-ink">
                            Tipo de automatización
                            <Input
                                value={form.automationType}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        automationType: event.target.value,
                                    }))
                                }
                                placeholder="Playwright"
                                className="mt-2"
                            />
                        </label>
                        <label className="text-sm font-semibold text-ink">
                            Referencia
                            <Input
                                value={form.automationRef}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        automationRef: event.target.value,
                                    }))
                                }
                                placeholder="tests/auth/login.spec.ts"
                                className="mt-2"
                            />
                        </label>
                    </div>
                ) : null}

                {!suites.length ? (
                    <p className="rounded-lg bg-warning-500/10 px-4 py-2 text-sm text-warning-600">
                        Necesitas al menos una suite para crear casos.
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
                        {submitting ? "Guardando..." : "Guardar caso"}
                    </Button>
                </div>
            </div>
        </Sheet>
    );
}
