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
    // stepsText: string; // Removed in favor of stepsList
    status: TestCaseStatus;
    priority: string;
    isAutomated: boolean;
    automationType: string;
    automationRef: string;
    tags: string[];
};

const emptyForm: TestCaseFormState = {
    suiteId: "",
    title: "",
    description: "",
    preconditions: "",
    status: "draft",
    priority: "3",
    isAutomated: false,
    automationType: "",
    automationRef: "",
    tags: [],
};

const statusOptions: Array<{ value: TestCaseStatus; label: string }> = [
    { value: "draft", label: "Draft" },
    { value: "ready", label: "Ready" },
    { value: "deprecated", label: "Deprecated" },
];

export function TestCaseFormSheet({
    open,
    testCase,
    suites,
    onClose,
    onSave,
}: TestCaseFormSheetProps) {
    const [form, setForm] = useState<TestCaseFormState & { stepsList: { id: string; step: string; expectedResult: string }[] }>({
        ...emptyForm,
        stepsList: [],
    });
    const [currentTag, setCurrentTag] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const title = useMemo(
        () => (testCase ? "Edit Test Case" : "New Test Case"),
        [testCase],
    );

    useEffect(() => {
        if (testCase) {
            let initialSteps: { id: string; step: string; expectedResult: string }[] = [];

            if (Array.isArray(testCase.steps)) {
                if (testCase.steps.length > 0 && typeof testCase.steps[0] === 'string') {
                    // Legacy string array
                    initialSteps = (testCase.steps as string[]).map(s => ({
                        id: crypto.randomUUID(),
                        step: s,
                        expectedResult: ""
                    }));
                } else {
                    // Structured array
                    initialSteps = (testCase.steps as any[]).map(s => ({
                        id: crypto.randomUUID(),
                        step: s.step || "",
                        expectedResult: s.expectedResult || ""
                    }));
                }
            }

            setForm({
                suiteId: testCase.suiteId,
                title: testCase.title,
                description: testCase.description ?? "",
                preconditions: testCase.preconditions ?? "",
                stepsList: initialSteps,
                status: testCase.status,
                priority: String(testCase.priority ?? 3),
                isAutomated: testCase.isAutomated,
                automationType: testCase.automationType ?? "",
                automationRef: testCase.automationRef ?? "",
                tags: testCase.tags ?? [],
            });
        } else {
            setForm({ ...emptyForm, stepsList: [] });
        }

        setCurrentTag("");
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

    const addStep = () => {
        setForm(prev => ({
            ...prev,
            stepsList: [...prev.stepsList, { id: crypto.randomUUID(), step: "", expectedResult: "" }]
        }));
    };

    const removeStep = (id: string) => {
        setForm(prev => ({
            ...prev,
            stepsList: prev.stepsList.filter(s => s.id !== id)
        }));
    };

    const updateStep = (id: string, field: 'step' | 'expectedResult', value: string) => {
        setForm(prev => ({
            ...prev,
            stepsList: prev.stepsList.map(s => s.id === id ? { ...s, [field]: value } : s)
        }));
    };

    const handleAddTag = () => {
        const value = currentTag.trim();
        if (value && !form.tags.includes(value)) {
            setForm((prev) => ({
                ...prev,
                tags: [...prev.tags, value],
            }));
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
            const steps = form.stepsList
                .map(({ step, expectedResult }) => ({ step: step.trim(), expectedResult: expectedResult.trim() }))
                .filter(s => s.step || s.expectedResult);

            const payload: TestCasePayload = {
                suiteId: form.suiteId,
                title: form.title.trim(),
                description: form.description.trim() || null,
                preconditions: form.preconditions.trim() || null,
                steps,
                tags: form.tags,
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
                    : "Could not save test case.",
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
            description="Define the details, status, and steps of the test case."
            onClose={onClose}
        >
            <div className="grid gap-4">
                <label className="text-sm font-semibold text-ink">
                    Test Suite
                    <select
                        value={form.suiteId}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, suiteId: event.target.value }))
                        }
                        className="mt-2 h-10 w-full rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
                    >
                        <option value="">Select a suite</option>
                        {suites.map((suite) => (
                            <option key={suite.id} value={suite.id}>
                                {suite.projectKey} · {suite.testPlanName} · {suite.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="text-sm font-semibold text-ink">
                    Test Case Title
                    <Input
                        value={form.title}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, title: event.target.value }))
                        }
                        placeholder="Validate login with 2FA"
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
                        placeholder="Context of the test case"
                        className="mt-2 min-h-[88px] w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                    />
                </label>

                <label className="text-sm font-semibold text-ink">
                    Preconditions
                    <textarea
                        value={form.preconditions}
                        onChange={(event) =>
                            setForm((prev) => ({
                                ...prev,
                                preconditions: event.target.value,
                            }))
                        }
                        placeholder="Data or states required before execution"
                        className="mt-2 min-h-[88px] w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                    />
                </label>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-ink">Steps</label>
                    <div className="flex flex-col gap-3">
                        {form.stepsList?.map((item, index) => (
                            <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-stroke bg-gray-50 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-xs font-medium text-ink/60">Step {index + 1}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeStep(item.id)}
                                        className="text-xs text-danger-500 hover:text-danger-700"
                                    >
                                        Delete
                                    </button>
                                </div>
                                <textarea
                                    value={item.step}
                                    onChange={(e) => updateStep(item.id, 'step', e.target.value)}
                                    placeholder="Step description"
                                    className="min-h-[60px] w-full rounded border border-stroke bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-300"
                                />
                                <textarea
                                    value={item.expectedResult}
                                    onChange={(e) => updateStep(item.id, 'expectedResult', e.target.value)}
                                    placeholder="Expected result"
                                    className="min-h-[40px] w-full rounded border border-stroke bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-300"
                                />
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="secondary"
                            className="w-full"
                            onClick={addStep}
                        >
                            + Add step
                        </Button>
                    </div>
                </div>

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

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-semibold text-ink">
                        Status
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
                    Automated Case
                </label>

                {form.isAutomated ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="text-sm font-semibold text-ink">
                            Automation Type
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
                            Reference
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
                        You need at least one suite to create cases.
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
                        {submitting ? "Saving..." : "Save Test Case"}
                    </Button>
                </div>
            </div>
        </Sheet>
    );
}
