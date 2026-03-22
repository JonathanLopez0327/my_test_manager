"use client";

import { Badge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import type { TestCaseRecord, TestCaseStatus, TestCaseStyle } from "./types";
import { AssistantHubTrigger } from "@/components/assistant-hub/AssistantHubTrigger";

type TestCaseDetailSheetProps = {
  open: boolean;
  testCase: TestCaseRecord | null;
  onClose: () => void;
};

const statusLabels: Record<TestCaseStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  deprecated: "Deprecated",
};

const statusTones: Record<TestCaseStatus, "success" | "warning" | "danger" | "neutral"> = {
  draft: "neutral",
  ready: "success",
  deprecated: "warning",
};

const styleLabels: Record<TestCaseStyle, string> = {
  step_by_step: "Step-by-Step",
  gherkin: "BDD/Gherkin",
  data_driven: "Data-Driven",
  api: "API",
};

const styleTones: Record<TestCaseStyle, "success" | "warning" | "danger" | "neutral"> = {
  step_by_step: "neutral",
  gherkin: "success",
  data_driven: "warning",
  api: "danger",
};

type StepByStepItem = { step?: unknown; expectedResult?: unknown };
type GherkinClause = { keyword?: unknown; text?: unknown };
type DataDrivenSteps = {
  template?: unknown;
  examples?: {
    columns?: unknown;
    rows?: unknown;
  };
};
type ApiSteps = {
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

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString();
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseStepByStep(steps: unknown): Array<{ step: string; expectedResult: string }> {
  if (!Array.isArray(steps)) return [];
  return steps
    .map((item) => {
      if (typeof item === "string") {
        return { step: item, expectedResult: "" };
      }
      const stepItem = (item ?? {}) as StepByStepItem;
      return {
        step: asString(stepItem.step),
        expectedResult: asString(stepItem.expectedResult),
      };
    })
    .filter((item) => item.step || item.expectedResult);
}

function parseGherkin(steps: unknown): Array<{ keyword: string; text: string }> {
  if (!Array.isArray(steps)) return [];
  return steps
    .map((item) => {
      const clause = (item ?? {}) as GherkinClause;
      return {
        keyword: asString(clause.keyword) || "Given",
        text: asString(clause.text),
      };
    })
    .filter((item) => item.text);
}

function parseDataDriven(steps: unknown): {
  template: Array<{ keyword: string; text: string }>;
  columns: string[];
  rows: string[][];
} {
  if (!steps || typeof steps !== "object") {
    return { template: [], columns: [], rows: [] };
  }
  const parsed = steps as DataDrivenSteps;
  const template = parseGherkin(parsed.template);
  const columns = Array.isArray(parsed.examples?.columns)
    ? parsed.examples.columns.map((column) => asString(column)).filter(Boolean)
    : [];
  const rows = Array.isArray(parsed.examples?.rows)
    ? parsed.examples.rows
        .filter((row) => Array.isArray(row))
        .map((row) => (row as unknown[]).map((cell) => asString(cell)))
    : [];
  return { template, columns, rows };
}

function parseHeaders(headers: unknown): Array<{ key: string; value: string }> {
  if (!Array.isArray(headers)) return [];
  return headers
    .map((item) => {
      if (!item || typeof item !== "object") return { key: "", value: "" };
      const record = item as { key?: unknown; value?: unknown };
      return { key: asString(record.key), value: asString(record.value) };
    })
    .filter((item) => item.key || item.value);
}

function parseApi(steps: unknown): {
  method: string;
  endpoint: string;
  requestBody: string;
  requestHeaders: Array<{ key: string; value: string }>;
  expectedStatus: string;
  expectedBody: string;
  expectedHeaders: Array<{ key: string; value: string }>;
} {
  if (!steps || typeof steps !== "object") {
    return {
      method: "",
      endpoint: "",
      requestBody: "",
      requestHeaders: [],
      expectedStatus: "",
      expectedBody: "",
      expectedHeaders: [],
    };
  }
  const parsed = steps as ApiSteps;
  return {
    method: asString(parsed.request?.method),
    endpoint: asString(parsed.request?.endpoint),
    requestBody: asString(parsed.request?.body),
    requestHeaders: parseHeaders(parsed.request?.headers),
    expectedStatus: asString(parsed.expectedResponse?.status),
    expectedBody: asString(parsed.expectedResponse?.body),
    expectedHeaders: parseHeaders(parsed.expectedResponse?.headers),
  };
}

export function TestCaseDetailSheet({ open, testCase, onClose }: TestCaseDetailSheetProps) {
  if (!testCase) return null;

  const stepByStep = testCase.style === "step_by_step" ? parseStepByStep(testCase.steps) : [];
  const gherkin = testCase.style === "gherkin" ? parseGherkin(testCase.steps) : [];
  const dataDriven = testCase.style === "data_driven" ? parseDataDriven(testCase.steps) : null;
  const api = testCase.style === "api" ? parseApi(testCase.steps) : null;

  return (
    <Sheet
      open={open}
      title={testCase.title}
      description={`${testCase.suite.testPlan.project.key} · ${testCase.suite.testPlan.name} · ${testCase.suite.name}`}
      onClose={onClose}
      width="2xl"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTones[testCase.status]}>{statusLabels[testCase.status]}</Badge>
            <Badge tone={styleTones[testCase.style]}>{styleLabels[testCase.style]}</Badge>
            <Badge tone="neutral">P{Number.isFinite(testCase.priority) ? testCase.priority : 3}</Badge>
            <Badge tone="neutral">
              {testCase.isAutomated ? testCase.automationType ?? "Automated" : "Manual"}
            </Badge>
          </div>
          <AssistantHubTrigger
            context={{ type: "testCase", testCaseId: testCase.id, testCaseTitle: testCase.title, projectId: testCase.suite.testPlan.project.id }}
            label="Ask AI"
            variant="button"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Project</p>
            <p className="mt-1 text-sm text-ink">{testCase.suite.testPlan.project.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Suite</p>
            <p className="mt-1 text-sm text-ink">{testCase.suite.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Created</p>
            <p className="mt-1 text-sm text-ink">{formatDate(testCase.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Updated</p>
            <p className="mt-1 text-sm text-ink">{formatDate(testCase.updatedAt)}</p>
          </div>
          {testCase.automationRef ? (
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Automation Ref</p>
              <p className="mt-1 break-all text-sm text-ink">{testCase.automationRef}</p>
            </div>
          ) : null}
        </div>

        {testCase.description ? (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Description</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{testCase.description}</p>
          </section>
        ) : null}

        {testCase.preconditions ? (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Preconditions</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{testCase.preconditions}</p>
          </section>
        ) : null}

        {(testCase.tags?.length ?? 0) > 0 ? (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Tags</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {testCase.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">Steps</p>

          {testCase.style === "step_by_step" ? (
            stepByStep.length > 0 ? (
              <div className="mt-2 space-y-3">
                {stepByStep.map((item, index) => (
                  <div key={`${index}-${item.step}`} className="rounded-lg border border-stroke bg-surface-muted p-3">
                    <p className="text-xs font-semibold text-ink-muted">Step {index + 1}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.step || "-"}</p>
                    <p className="mt-2 text-xs font-semibold text-ink-muted">Expected result</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.expectedResult || "-"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">No steps were defined.</p>
            )
          ) : null}

          {testCase.style === "gherkin" ? (
            gherkin.length > 0 ? (
              <div className="mt-2 space-y-2 rounded-lg border border-stroke bg-surface-muted p-3">
                {gherkin.map((item, index) => (
                  <p key={`${index}-${item.keyword}`} className="text-sm text-ink">
                    <span className="font-semibold">{item.keyword}</span> {item.text}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">No clauses were defined.</p>
            )
          ) : null}

          {testCase.style === "data_driven" && dataDriven ? (
            <div className="mt-2 space-y-3">
              {dataDriven.template.length > 0 ? (
                <div className="rounded-lg border border-stroke bg-surface-muted p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Template</p>
                  <div className="mt-2 space-y-1.5">
                    {dataDriven.template.map((item, index) => (
                      <p key={`${index}-${item.keyword}`} className="text-sm text-ink">
                        <span className="font-semibold">{item.keyword}</span> {item.text}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {dataDriven.columns.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-stroke">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="bg-surface-muted">
                        {dataDriven.columns.map((column) => (
                          <th key={column} className="border-b border-stroke px-3 py-2 text-left text-ink">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataDriven.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t border-stroke">
                          {dataDriven.columns.map((column, colIndex) => (
                            <td key={`${rowIndex}-${column}`} className="px-3 py-2 text-ink-muted">
                              {row[colIndex] || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-ink-muted">No examples table was defined.</p>
              )}
            </div>
          ) : null}

          {testCase.style === "api" && api ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-stroke bg-surface-muted p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Request</p>
                <p className="mt-2 text-sm text-ink">
                  <span className="font-semibold">Method:</span> {api.method || "-"}
                </p>
                <p className="mt-1 break-all text-sm text-ink">
                  <span className="font-semibold">Endpoint:</span> {api.endpoint || "-"}
                </p>
                {api.requestHeaders.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-ink-muted">Headers</p>
                    <div className="mt-1 space-y-1">
                      {api.requestHeaders.map((header, index) => (
                        <p key={`${header.key}-${index}`} className="text-xs text-ink-muted">
                          {header.key || "-"}: {header.value || "-"}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {api.requestBody ? (
                  <pre className="mt-2 overflow-x-auto rounded bg-surface-elevated p-2 text-xs text-ink">
                    {api.requestBody}
                  </pre>
                ) : null}
              </div>

              <div className="rounded-lg border border-stroke bg-surface-muted p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Expected Response</p>
                <p className="mt-2 text-sm text-ink">
                  <span className="font-semibold">Status:</span> {api.expectedStatus || "-"}
                </p>
                {api.expectedHeaders.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-ink-muted">Headers</p>
                    <div className="mt-1 space-y-1">
                      {api.expectedHeaders.map((header, index) => (
                        <p key={`${header.key}-${index}`} className="text-xs text-ink-muted">
                          {header.key || "-"}: {header.value || "-"}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {api.expectedBody ? (
                  <pre className="mt-2 overflow-x-auto rounded bg-surface-elevated p-2 text-xs text-ink">
                    {api.expectedBody}
                  </pre>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </Sheet>
  );
}
