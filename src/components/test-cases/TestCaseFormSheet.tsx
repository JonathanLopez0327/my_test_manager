"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { StepByStepEditor } from "./StepByStepEditor";
import { GherkinEditor } from "./GherkinEditor";
import { DataDrivenEditor } from "./DataDrivenEditor";
import { ApiStyleEditor } from "./ApiStyleEditor";
import type {
    TestCasePayload,
    TestCaseRecord,
    TestCaseStatus,
    TestCaseStyle,
    GherkinKeyword,
    ApiRequest,
    ApiExpectedResponse,
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

type StepItem = { id: string; step: string; expectedResult: string };
type ClauseItem = { id: string; keyword: GherkinKeyword; text: string };
type ExamplesState = { columns: string[]; rows: string[][] };

type TestCaseFormState = {
    suiteId: string;
    title: string;
    style: TestCaseStyle;
    description: string;
    preconditions: string;
    status: TestCaseStatus;
    priority: string;
    isAutomated: boolean;
    automationType: string;
    automationRef: string;
    tags: string[];
    // Step-by-step
    stepsList: StepItem[];
    // Gherkin
    gherkinClauses: ClauseItem[];
    // Data-driven
    dataDrivenTemplate: ClauseItem[];
    dataDrivenExamples: ExamplesState;
    // API
    apiRequest: ApiRequest;
    apiExpectedResponse: ApiExpectedResponse;
};

const emptyApiRequest: ApiRequest = { method: "GET", endpoint: "", headers: [], body: "" };
const emptyApiResponse: ApiExpectedResponse = { status: "", body: "", headers: [] };

const emptyForm: TestCaseFormState = {
    suiteId: "",
    title: "",
    style: "step_by_step",
    description: "",
    preconditions: "",
    status: "draft",
    priority: "3",
    isAutomated: false,
    automationType: "",
    automationRef: "",
    tags: [],
    stepsList: [],
    gherkinClauses: [],
    dataDrivenTemplate: [],
    dataDrivenExamples: { columns: [], rows: [] },
    apiRequest: { ...emptyApiRequest },
    apiExpectedResponse: { ...emptyApiResponse },
};

const statusOptions: Array<{ value: TestCaseStatus; label: string }> = [
    { value: "draft", label: "Draft" },
    { value: "ready", label: "Ready" },
    { value: "deprecated", label: "Deprecated" },
];

const styleOptions: Array<{ value: TestCaseStyle; label: string }> = [
    { value: "step_by_step", label: "Step-by-Step" },
    { value: "gherkin", label: "BDD / Gherkin" },
    { value: "data_driven", label: "Data-Driven" },
    { value: "api", label: "API (Request/Response)" },
];

const VALID_STYLES: TestCaseStyle[] = ["step_by_step", "gherkin", "data_driven", "api"];

function isValidStyle(value: unknown): value is TestCaseStyle {
    return typeof value === "string" && VALID_STYLES.includes(value as TestCaseStyle);
}

export function TestCaseFormSheet({
    open,
    testCase,
    suites,
    onClose,
    onSave,
}: TestCaseFormSheetProps) {
    const [form, setForm] = useState<TestCaseFormState>({ ...emptyForm });
    const [currentTag, setCurrentTag] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const title = useMemo(
        () => (testCase ? "Edit Test Case" : "New Test Case"),
        [testCase],
    );

    useEffect(() => {
        if (testCase) {
            const style: TestCaseStyle = isValidStyle(testCase.style) ? testCase.style : "step_by_step";
            const newForm: TestCaseFormState = {
                suiteId: testCase.suiteId,
                title: testCase.title,
                style,
                description: testCase.description ?? "",
                preconditions: testCase.preconditions ?? "",
                status: testCase.status,
                priority: String(testCase.priority ?? 3),
                isAutomated: testCase.isAutomated,
                automationType: testCase.automationType ?? "",
                automationRef: testCase.automationRef ?? "",
                tags: testCase.tags ?? [],
                stepsList: [],
                gherkinClauses: [],
                dataDrivenTemplate: [],
                dataDrivenExamples: { columns: [], rows: [] },
                apiRequest: { ...emptyApiRequest },
                apiExpectedResponse: { ...emptyApiResponse },
            };

            const steps = testCase.steps as any;

            switch (style) {
                case "step_by_step": {
                    if (Array.isArray(steps)) {
                        if (steps.length > 0 && typeof steps[0] === "string") {
                            newForm.stepsList = (steps as string[]).map((s) => ({
                                id: crypto.randomUUID(), step: s, expectedResult: "",
                            }));
                        } else {
                            newForm.stepsList = steps.map((s: any) => ({
                                id: crypto.randomUUID(),
                                step: s.step || "",
                                expectedResult: s.expectedResult || "",
                            }));
                        }
                    }
                    break;
                }
                case "gherkin": {
                    if (Array.isArray(steps)) {
                        newForm.gherkinClauses = steps.map((c: any) => ({
                            id: crypto.randomUUID(),
                            keyword: c.keyword || "Given",
                            text: c.text || "",
                        }));
                    }
                    break;
                }
                case "data_driven": {
                    if (steps && typeof steps === "object") {
                        if (Array.isArray(steps.template)) {
                            newForm.dataDrivenTemplate = steps.template.map((c: any) => ({
                                id: crypto.randomUUID(),
                                keyword: c.keyword || "Given",
                                text: c.text || "",
                            }));
                        }
                        if (steps.examples && typeof steps.examples === "object") {
                            newForm.dataDrivenExamples = {
                                columns: Array.isArray(steps.examples.columns) ? steps.examples.columns : [],
                                rows: Array.isArray(steps.examples.rows) ? steps.examples.rows : [],
                            };
                        }
                    }
                    break;
                }
                case "api": {
                    if (steps && typeof steps === "object") {
                        const req = steps.request || {};
                        const res = steps.expectedResponse || {};
                        newForm.apiRequest = {
                            method: req.method || "GET",
                            endpoint: req.endpoint || "",
                            headers: Array.isArray(req.headers) ? req.headers : [],
                            body: req.body || "",
                        };
                        newForm.apiExpectedResponse = {
                            status: res.status || "",
                            body: res.body || "",
                            headers: Array.isArray(res.headers) ? res.headers : [],
                        };
                    }
                    break;
                }
            }

            setForm(newForm);
        } else {
            setForm({ ...emptyForm });
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

    const handleStyleChange = (newStyle: TestCaseStyle) => {
        setForm((prev) => ({
            ...prev,
            style: newStyle,
            stepsList: [],
            gherkinClauses: [],
            dataDrivenTemplate: [],
            dataDrivenExamples: { columns: [], rows: [] },
            apiRequest: { ...emptyApiRequest },
            apiExpectedResponse: { ...emptyApiResponse },
        }));
    };

    // Step-by-step handlers
    const addStep = () => {
        setForm((prev) => ({
            ...prev,
            stepsList: [...prev.stepsList, { id: crypto.randomUUID(), step: "", expectedResult: "" }],
        }));
    };
    const removeStep = (id: string) => {
        setForm((prev) => ({ ...prev, stepsList: prev.stepsList.filter((s) => s.id !== id) }));
    };
    const updateStep = (id: string, field: "step" | "expectedResult", value: string) => {
        setForm((prev) => ({
            ...prev,
            stepsList: prev.stepsList.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
        }));
    };

    // Gherkin handlers
    const addGherkinClause = () => {
        setForm((prev) => ({
            ...prev,
            gherkinClauses: [...prev.gherkinClauses, { id: crypto.randomUUID(), keyword: "Given" as GherkinKeyword, text: "" }],
        }));
    };
    const removeGherkinClause = (id: string) => {
        setForm((prev) => ({ ...prev, gherkinClauses: prev.gherkinClauses.filter((c) => c.id !== id) }));
    };
    const updateGherkinClause = (id: string, field: "keyword" | "text", value: string) => {
        setForm((prev) => ({
            ...prev,
            gherkinClauses: prev.gherkinClauses.map((c) =>
                c.id === id ? { ...c, [field]: value } : c,
            ),
        }));
    };

    // Data-driven handlers
    const addDDClause = () => {
        setForm((prev) => ({
            ...prev,
            dataDrivenTemplate: [...prev.dataDrivenTemplate, { id: crypto.randomUUID(), keyword: "Given" as GherkinKeyword, text: "" }],
        }));
    };
    const removeDDClause = (id: string) => {
        setForm((prev) => ({ ...prev, dataDrivenTemplate: prev.dataDrivenTemplate.filter((c) => c.id !== id) }));
    };
    const updateDDClause = (id: string, field: "keyword" | "text", value: string) => {
        setForm((prev) => ({
            ...prev,
            dataDrivenTemplate: prev.dataDrivenTemplate.map((c) =>
                c.id === id ? { ...c, [field]: value } : c,
            ),
        }));
    };
    const updateDDExamples = (examples: ExamplesState) => {
        setForm((prev) => ({ ...prev, dataDrivenExamples: examples }));
    };

    // Tag handlers
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
        setForm((prev) => ({ ...prev, tags: prev.tags.filter((tag) => tag !== tagToRemove) }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            let steps: unknown;

            switch (form.style) {
                case "step_by_step":
                    steps = form.stepsList
                        .map(({ step, expectedResult }) => ({ step: step.trim(), expectedResult: expectedResult.trim() }))
                        .filter((s) => s.step || s.expectedResult);
                    break;
                case "gherkin":
                    steps = form.gherkinClauses
                        .map(({ keyword, text }) => ({ keyword, text: text.trim() }))
                        .filter((c) => c.text);
                    break;
                case "data_driven":
                    steps = {
                        template: form.dataDrivenTemplate
                            .map(({ keyword, text }) => ({ keyword, text: text.trim() }))
                            .filter((c) => c.text),
                        examples: form.dataDrivenExamples,
                    };
                    break;
                case "api":
                    steps = {
                        request: form.apiRequest,
                        expectedResponse: form.apiExpectedResponse,
                    };
                    break;
            }

            const payload: TestCasePayload = {
                suiteId: form.suiteId,
                title: form.title.trim(),
                style: form.style,
                description: form.description.trim() || null,
                preconditions: form.preconditions.trim() || null,
                steps,
                tags: form.tags,
                status: form.status,
                priority: Number.isFinite(Number(form.priority)) ? Number(form.priority) : 3,
                isAutomated: form.isAutomated,
                automationType: form.isAutomated ? form.automationType.trim() || null : null,
                automationRef: form.isAutomated ? form.automationRef.trim() || null : null,
            };
            await onSave(payload, testCase?.id);
            onClose();
        } catch (submitError) {
            setError(
                submitError instanceof Error ? submitError.message : "Could not save test case.",
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
                        className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
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
                        className="mt-2 min-h-[88px] w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
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
                        className="mt-2 min-h-[88px] w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                    />
                </label>

                {/* Style selector */}
                <label className="text-sm font-semibold text-ink">
                    Test Case Style
                    <select
                        value={form.style}
                        onChange={(e) => handleStyleChange(e.target.value as TestCaseStyle)}
                        className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
                    >
                        {styleOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </label>

                {/* Conditional editor by style */}
                {form.style === "step_by_step" && (
                    <StepByStepEditor
                        steps={form.stepsList}
                        onAdd={addStep}
                        onRemove={removeStep}
                        onUpdate={updateStep}
                    />
                )}

                {form.style === "gherkin" && (
                    <GherkinEditor
                        clauses={form.gherkinClauses}
                        onAdd={addGherkinClause}
                        onRemove={removeGherkinClause}
                        onUpdate={updateGherkinClause}
                    />
                )}

                {form.style === "data_driven" && (
                    <DataDrivenEditor
                        template={form.dataDrivenTemplate}
                        examples={form.dataDrivenExamples}
                        onAddClause={addDDClause}
                        onRemoveClause={removeDDClause}
                        onUpdateClause={updateDDClause}
                        onUpdateExamples={updateDDExamples}
                    />
                )}

                {form.style === "api" && (
                    <ApiStyleEditor
                        request={form.apiRequest}
                        expectedResponse={form.apiExpectedResponse}
                        onUpdateRequest={(req) => setForm((prev) => ({ ...prev, apiRequest: req }))}
                        onUpdateResponse={(res) => setForm((prev) => ({ ...prev, apiExpectedResponse: res }))}
                    />
                )}

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
                            className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
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
