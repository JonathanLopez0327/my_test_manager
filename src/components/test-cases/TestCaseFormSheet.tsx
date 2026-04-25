"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { StepByStepEditor } from "./StepByStepEditor";
import { GherkinEditor } from "./GherkinEditor";
import { DataDrivenEditor } from "./DataDrivenEditor";
import { ApiStyleEditor } from "./ApiStyleEditor";
import { useT } from "@/lib/i18n/LocaleProvider";
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
    defaultSuiteId?: string;
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
type StepByStepRaw = { step?: unknown; expectedResult?: unknown };
type GherkinRaw = { keyword?: unknown; text?: unknown };
type DataDrivenRaw = {
    template?: unknown;
    examples?: {
        columns?: unknown;
        rows?: unknown;
    };
};
type ApiRaw = {
    request?: {
        method?: unknown;
        endpoint?: unknown;
        headers?: unknown;
        body?: unknown;
    };
    expectedResponse?: {
        status?: unknown;
        body?: unknown;
        headers?: unknown;
    };
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

const statusOrder: TestCaseStatus[] = ["draft", "ready", "deprecated"];
const styleOrder: TestCaseStyle[] = ["step_by_step", "gherkin", "data_driven", "api"];

const VALID_STYLES: TestCaseStyle[] = ["step_by_step", "gherkin", "data_driven", "api"];

function isValidStyle(value: unknown): value is TestCaseStyle {
    return typeof value === "string" && VALID_STYLES.includes(value as TestCaseStyle);
}

export function TestCaseFormSheet({
    open,
    testCase,
    suites,
    defaultSuiteId,
    onClose,
    onSave,
}: TestCaseFormSheetProps) {
    const t = useT();
    const [form, setForm] = useState<TestCaseFormState>({ ...emptyForm });
    const [currentTag, setCurrentTag] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const title = useMemo(
        () => (testCase ? t.testCases.form.titleEdit : t.testCases.form.titleNew),
        [testCase, t],
    );

    const styleLabels: Record<TestCaseStyle, string> = {
        step_by_step: t.testCases.form.styleStepByStep,
        gherkin: t.testCases.form.styleGherkin,
        data_driven: t.testCases.form.styleDataDriven,
        api: t.testCases.form.styleApi,
    };

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

            const steps = testCase.steps as unknown;

            switch (style) {
                case "step_by_step": {
                    if (Array.isArray(steps)) {
                        if (steps.length > 0 && typeof steps[0] === "string") {
                            newForm.stepsList = (steps as string[]).map((s) => ({
                                id: crypto.randomUUID(), step: s, expectedResult: "",
                            }));
                        } else {
                            newForm.stepsList = steps.map((s) => {
                                const stepItem = (s ?? {}) as StepByStepRaw;
                                return ({
                                id: crypto.randomUUID(),
                                step: String(stepItem.step ?? ""),
                                expectedResult: String(stepItem.expectedResult ?? ""),
                            });
                            });
                        }
                    }
                    break;
                }
                case "gherkin": {
                    if (Array.isArray(steps)) {
                        newForm.gherkinClauses = steps.map((c) => {
                            const clause = (c ?? {}) as GherkinRaw;
                            return ({
                            id: crypto.randomUUID(),
                            keyword: (clause.keyword as GherkinKeyword) || "Given",
                            text: String(clause.text ?? ""),
                        });
                        });
                    }
                    break;
                }
                case "data_driven": {
                    if (steps && typeof steps === "object") {
                        const dataDrivenSteps = steps as DataDrivenRaw;
                        if (Array.isArray(dataDrivenSteps.template)) {
                            newForm.dataDrivenTemplate = dataDrivenSteps.template.map((c) => {
                                const clause = (c ?? {}) as GherkinRaw;
                                return ({
                                id: crypto.randomUUID(),
                                keyword: (clause.keyword as GherkinKeyword) || "Given",
                                text: String(clause.text ?? ""),
                            });
                            });
                        }
                        if (dataDrivenSteps.examples && typeof dataDrivenSteps.examples === "object") {
                            newForm.dataDrivenExamples = {
                                columns: Array.isArray(dataDrivenSteps.examples.columns)
                                    ? dataDrivenSteps.examples.columns.map((column) => String(column))
                                    : [],
                                rows: Array.isArray(dataDrivenSteps.examples.rows)
                                    ? dataDrivenSteps.examples.rows.map((row) =>
                                        Array.isArray(row) ? row.map((cell) => String(cell)) : [],
                                    )
                                    : [],
                            };
                        }
                    }
                    break;
                }
                case "api": {
                    if (steps && typeof steps === "object") {
                        const apiSteps = steps as ApiRaw;
                        const req = apiSteps.request || {};
                        const res = apiSteps.expectedResponse || {};
                        newForm.apiRequest = {
                            method: String(req.method ?? "GET"),
                            endpoint: String(req.endpoint ?? ""),
                            headers: Array.isArray(req.headers)
                                ? req.headers.filter((header): header is { key: string; value: string } =>
                                    typeof header === "object" && header !== null,
                                ).map((header) => ({
                                    key: String(header.key ?? ""),
                                    value: String(header.value ?? ""),
                                }))
                                : [],
                            body: String(req.body ?? ""),
                        };
                        newForm.apiExpectedResponse = {
                            status: String(res.status ?? ""),
                            body: String(res.body ?? ""),
                            headers: Array.isArray(res.headers)
                                ? res.headers.filter((header): header is { key: string; value: string } =>
                                    typeof header === "object" && header !== null,
                                ).map((header) => ({
                                    key: String(header.key ?? ""),
                                    value: String(header.value ?? ""),
                                }))
                                : [],
                        };
                    }
                    break;
                }
            }

            setForm(newForm);
        } else {
            setForm({
                ...emptyForm,
                suiteId: defaultSuiteId ?? "",
            });
        }

        setCurrentTag("");
        setError(null);
    }, [testCase, open, defaultSuiteId]);

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
                submitError instanceof Error ? submitError.message : t.testCases.form.couldNotSave,
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
            description={t.testCases.form.description}
            onClose={onClose}
        >
            <div className="grid gap-4">
                <label className="text-sm font-semibold text-ink">
                    {t.testCases.form.suiteLabel}
                    <select
                        value={form.suiteId}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, suiteId: event.target.value }))
                        }
                        className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
                    >
                        <option value="">{t.testCases.form.selectSuite}</option>
                        {suites.map((suite) => (
                            <option key={suite.id} value={suite.id}>
                                {suite.projectKey} · {suite.testPlanName} · {suite.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="text-sm font-semibold text-ink">
                    {t.testCases.form.titleLabel}
                    <Input
                        value={form.title}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, title: event.target.value }))
                        }
                        placeholder={t.testCases.form.titlePlaceholder}
                        className="mt-2"
                    />
                </label>

                <label className="text-sm font-semibold text-ink">
                    {t.testCases.form.descriptionLabel}
                    <textarea
                        value={form.description}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                        placeholder={t.testCases.form.descriptionPlaceholder}
                        className="mt-2 min-h-[88px] w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                    />
                </label>

                <label className="text-sm font-semibold text-ink">
                    {t.testCases.form.preconditionsLabel}
                    <textarea
                        value={form.preconditions}
                        onChange={(event) =>
                            setForm((prev) => ({
                                ...prev,
                                preconditions: event.target.value,
                            }))
                        }
                        placeholder={t.testCases.form.preconditionsPlaceholder}
                        className="mt-2 min-h-[88px] w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                    />
                </label>

                <label className="text-sm font-semibold text-ink">
                    {t.testCases.form.styleLabel}
                    <select
                        value={form.style}
                        onChange={(e) => handleStyleChange(e.target.value as TestCaseStyle)}
                        className="mt-2 h-10 w-full rounded-lg border border-stroke bg-surface-elevated dark:bg-surface-muted px-3 text-sm text-ink"
                    >
                        {styleOrder.map((value) => (
                            <option key={value} value={value}>
                                {styleLabels[value]}
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
                    <label className="text-sm font-semibold text-ink">{t.testCases.form.tagsLabel}</label>
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
                        placeholder={t.testCases.form.tagsPlaceholder}
                        onKeyDown={handleTagKeyDown}
                        className="mt-1"
                    />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-semibold text-ink">
                        {t.testCases.form.statusLabel}
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
                            {statusOrder.map((value) => (
                                <option key={value} value={value}>
                                    {t.testCases.statuses[value]}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="text-sm font-semibold text-ink">
                        {t.testCases.form.priorityLabel}
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
                    {t.testCases.form.automatedLabel}
                </label>

                {form.isAutomated ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="text-sm font-semibold text-ink">
                            {t.testCases.form.automationTypeLabel}
                            <Input
                                value={form.automationType}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        automationType: event.target.value,
                                    }))
                                }
                                placeholder={t.testCases.form.automationTypePlaceholder}
                                className="mt-2"
                            />
                        </label>
                        <label className="text-sm font-semibold text-ink">
                            {t.testCases.form.automationRefLabel}
                            <Input
                                value={form.automationRef}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        automationRef: event.target.value,
                                    }))
                                }
                                placeholder={t.testCases.form.automationRefPlaceholder}
                                className="mt-2"
                            />
                        </label>
                    </div>
                ) : null}

                {!suites.length ? (
                    <p className="rounded-lg bg-warning-500/10 px-4 py-2 text-sm text-warning-600">
                        {t.testCases.form.noSuitesWarning}
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
                        {submitting ? t.testCases.form.saving : t.testCases.form.save}
                    </Button>
                </div>
            </div>
        </Sheet>
    );
}
