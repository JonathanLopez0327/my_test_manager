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

const gherkinTones: Record<"Given" | "When" | "Then" | "And", "success" | "info" | "danger" | "neutral"> = {
  Given: "success",
  When: "info",
  Then: "danger",
  And: "neutral",
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
    queryParams?: unknown;
    headers?: unknown;
    body?: unknown;
  };
  expectedResponse?: {
    status?: unknown;
    body?: unknown;
    headers?: unknown;
    assertions?: unknown;
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

function countDefined(items: unknown[]): number {
  return items.filter((item) => Boolean(item)).length;
}

function titleCase(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1).toLowerCase() : value;
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
      const keyword = titleCase(asString(clause.keyword).trim()) || "Given";
      return {
        keyword: keyword === "Given" || keyword === "When" || keyword === "Then" || keyword === "And" ? keyword : "Given",
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

function parseObjectPairs(value: unknown): Array<{ key: string; value: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .map(([key, itemValue]) => ({
      key: asString(key),
      value: typeof itemValue === "string" ? itemValue : JSON.stringify(itemValue),
    }))
    .filter((item) => item.key || item.value);
}

function parseKeyValueCollection(value: unknown): Array<{ key: string; value: string }> {
  const fromArray = parseHeaders(value);
  if (fromArray.length > 0) return fromArray;
  return parseObjectPairs(value);
}

function parseAssertions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .filter(Boolean);
  }
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, itemValue]) => `${key}: ${typeof itemValue === "string" ? itemValue : JSON.stringify(itemValue)}`);
  }
  return [];
}

function parseApi(steps: unknown): {
  method: string;
  endpoint: string;
  queryParams: Array<{ key: string; value: string }>;
  requestBody: string;
  requestHeaders: Array<{ key: string; value: string }>;
  expectedStatus: string;
  expectedBody: string;
  expectedHeaders: Array<{ key: string; value: string }>;
  assertions: string[];
} {
  if (!steps || typeof steps !== "object") {
    return {
      method: "",
      endpoint: "",
      queryParams: [],
      requestBody: "",
      requestHeaders: [],
      expectedStatus: "",
      expectedBody: "",
      expectedHeaders: [],
      assertions: [],
    };
  }
  const parsed = steps as ApiSteps;
  return {
    method: asString(parsed.request?.method),
    endpoint: asString(parsed.request?.endpoint),
    queryParams: parseKeyValueCollection(parsed.request?.queryParams),
    requestBody: asString(parsed.request?.body),
    requestHeaders: parseKeyValueCollection(parsed.request?.headers),
    expectedStatus: asString(parsed.expectedResponse?.status),
    expectedBody: asString(parsed.expectedResponse?.body),
    expectedHeaders: parseKeyValueCollection(parsed.expectedResponse?.headers),
    assertions: parseAssertions(parsed.expectedResponse?.assertions),
  };
}

type InfoTileProps = {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
};

function InfoTile({ label, value, hint, mono = false }: InfoTileProps) {
  return (
    <article className="rounded-lg border border-stroke bg-surface-muted/35 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{label}</p>
      <p className={`mt-1 text-sm font-semibold text-ink ${mono ? "break-all font-mono text-[13px]" : ""}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </article>
  );
}

type KeyValueListProps = {
  title: string;
  items: Array<{ key: string; value: string }>;
};

function KeyValueList({ title, items }: KeyValueListProps) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{title}</p>
      <dl className="space-y-1 rounded-md border border-stroke bg-surface-muted/30 p-2.5">
        {items.map((item, index) => (
          <div key={`${item.key}-${index}`} className="grid grid-cols-[minmax(86px,auto)_1fr] items-start gap-2">
            <dt className="truncate text-[11px] font-semibold text-ink-muted">{item.key || "-"}</dt>
            <dd className="break-all text-[11px] text-ink">{item.value || "-"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type CodeSurfaceProps = {
  title: string;
  value: string;
};

function CodeSurface({ title, value }: CodeSurfaceProps) {
  if (!value) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{title}</p>
      <pre className="max-h-56 overflow-auto rounded-md border border-stroke bg-surface p-2.5 text-[11px] leading-5 text-ink">
        <code className="whitespace-pre-wrap break-all">{value}</code>
      </pre>
    </div>
  );
}

export function TestCaseDetailSheet({ open, testCase, onClose }: TestCaseDetailSheetProps) {
  if (!testCase) return null;

  const stepByStep = testCase.style === "step_by_step" ? parseStepByStep(testCase.steps) : [];
  const gherkin = testCase.style === "gherkin" ? parseGherkin(testCase.steps) : [];
  const dataDriven = testCase.style === "data_driven" ? parseDataDriven(testCase.steps) : null;
  const api = testCase.style === "api" ? parseApi(testCase.steps) : null;

  const executionLabel = testCase.isAutomated ? testCase.automationType ?? "Automated" : "Manual";

  const styleMetric = (() => {
    if (testCase.style === "step_by_step") {
      return { label: "Step Count", value: String(stepByStep.length) };
    }
    if (testCase.style === "gherkin") {
      return { label: "Clause Count", value: String(gherkin.length) };
    }
    if (testCase.style === "data_driven" && dataDriven) {
      return {
        label: "Scenario Rows",
        value: `${dataDriven.template.length} clauses · ${dataDriven.rows.length} rows`,
      };
    }
    if (testCase.style === "api" && api) {
      const requestFields = countDefined([api.method, api.endpoint, api.requestBody]) + api.requestHeaders.length + api.queryParams.length;
      const responseFields = countDefined([api.expectedStatus, api.expectedBody]) + api.expectedHeaders.length + api.assertions.length;
      return {
        label: "Request/Response Fields",
        value: `${requestFields}/${responseFields}`,
      };
    }
    return { label: "Design Coverage", value: "Not defined" };
  })();

  const overviewItems: InfoTileProps[] = [
    { label: "Project", value: `${testCase.suite.testPlan.project.key} · ${testCase.suite.testPlan.project.name}` },
    { label: "Suite", value: testCase.suite.name, hint: testCase.suite.testPlan.name },
    { label: "Style", value: styleLabels[testCase.style] ?? "Unknown" },
    { label: "Priority", value: `P${Number.isFinite(testCase.priority) ? testCase.priority : 3}` },
    { label: "Execution Mode", value: executionLabel },
    { label: "Created", value: formatDate(testCase.createdAt) },
    { label: "Updated", value: formatDate(testCase.updatedAt) },
    { label: styleMetric.label, value: styleMetric.value },
  ];

  const qaContextItems: InfoTileProps[] = [
    {
      label: "Automation Status",
      value: testCase.isAutomated ? "Automated" : "Manual",
      hint: testCase.isAutomated ? "Automation-enabled test case" : "Executed manually",
    },
    {
      label: "Execution Signal",
      value: executionLabel,
      hint: testCase.isAutomated && !testCase.automationRef ? "No automation reference attached" : undefined,
    },
  ];

  if (testCase.automationRef) {
    qaContextItems.push({
      label: "Automation Ref",
      value: testCase.automationRef,
      mono: true,
    });
  }

  return (
    <Sheet
      open={open}
      title="Test Case Detail"
      description="Structured QA context and style-aware test design."
      onClose={onClose}
      width="2xl"
    >
      <div className="space-y-5">
        <header className="sticky top-0 z-20 rounded-xl border border-stroke bg-surface-elevated/95 p-3.5 shadow-sm backdrop-blur dark:bg-surface-muted/95">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <h3 className="break-words text-lg font-semibold leading-snug text-ink">{testCase.title}</h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={statusTones[testCase.status]}>{statusLabels[testCase.status]}</Badge>
                <Badge tone={styleTones[testCase.style]}>{styleLabels[testCase.style]}</Badge>
                <Badge tone="neutral">P{Number.isFinite(testCase.priority) ? testCase.priority : 3}</Badge>
                <Badge tone="neutral">{executionLabel}</Badge>
              </div>
              <p className="text-xs text-ink-muted">
                {testCase.suite.testPlan.project.key} · {testCase.suite.testPlan.project.name} · {testCase.suite.testPlan.name} · {testCase.suite.name}
              </p>
            </div>
            <div className="shrink-0">
              <AssistantHubTrigger
                context={{ type: "testCase", testCaseId: testCase.id, testCaseTitle: testCase.title, projectId: testCase.suite.testPlan.project.id }}
                label="Ask AI"
                variant="button"
                onBeforeOpen={onClose}
              />
            </div>
          </div>
        </header>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink">Overview</h4>
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Quick Scan</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {overviewItems.map((item) => (
              <InfoTile key={item.label} {...item} />
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink">QA Context</h4>
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Traceability</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {qaContextItems.map((item) => (
              <InfoTile key={item.label} {...item} />
            ))}
          </div>
          <p className="text-xs text-ink-muted">
            Linked runs, bugs, and requirement references are not included in this case payload.
          </p>
        </section>

        {testCase.description ? (
          <section className="rounded-lg border border-stroke/70 bg-surface-muted/20 px-3 py-3">
            <h4 className="text-sm font-semibold text-ink">Description</h4>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{testCase.description}</p>
          </section>
        ) : null}

        {testCase.preconditions ? (
          <section className="rounded-lg border border-stroke/70 bg-surface-muted/20 px-3 py-3">
            <h4 className="text-sm font-semibold text-ink">Preconditions</h4>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{testCase.preconditions}</p>
          </section>
        ) : null}

        <section className="space-y-3 rounded-xl border border-stroke bg-surface-elevated p-4 shadow-[0_10px_24px_-18px_rgba(21,33,62,0.35)] dark:bg-surface-muted">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-ink">Test Design</h4>
            <Badge tone={styleTones[testCase.style]}>{styleLabels[testCase.style]}</Badge>
          </div>

          {testCase.style === "step_by_step" ? (
            stepByStep.length > 0 ? (
              <ol className="space-y-2.5">
                {stepByStep.map((item, index) => (
                  <li key={`${index}-${item.step}`} className="relative rounded-lg border border-stroke bg-surface-muted/35 px-3 py-2.5">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stroke bg-surface text-xs font-semibold text-ink">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Action</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.step || "-"}</p>
                        </div>
                        <div className="rounded-md border border-stroke/80 bg-surface-elevated px-2.5 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Expected Result</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.expectedResult || "-"}</p>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-muted">No steps were defined.</p>
            )
          ) : null}

          {testCase.style === "gherkin" ? (
            gherkin.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-stroke bg-surface-muted/30 p-3">
                {gherkin.map((item, index) => (
                  <div key={`${index}-${item.keyword}`} className="grid grid-cols-[auto_1fr] items-start gap-2 rounded-md border border-stroke/70 bg-surface-elevated px-2.5 py-2">
                    <Badge tone={gherkinTones[item.keyword as keyof typeof gherkinTones] ?? "neutral"} className="font-mono">
                      {item.keyword}
                    </Badge>
                    <p className="whitespace-pre-wrap font-mono text-sm leading-6 text-ink">{item.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No clauses were defined.</p>
            )
          ) : null}

          {testCase.style === "data_driven" && dataDriven ? (
            <div className="space-y-3">
              {dataDriven.template.length > 0 ? (
                <div className="rounded-lg border border-stroke bg-surface-muted/30 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Scenario Template</p>
                  <div className="mt-2 space-y-2">
                    {dataDriven.template.map((item, index) => (
                      <div key={`${index}-${item.keyword}`} className="grid grid-cols-[auto_1fr] items-start gap-2 rounded-md border border-stroke/70 bg-surface-elevated px-2.5 py-2">
                        <Badge tone={gherkinTones[item.keyword as keyof typeof gherkinTones] ?? "neutral"} className="font-mono">
                          {item.keyword}
                        </Badge>
                        <p className="whitespace-pre-wrap font-mono text-sm leading-6 text-ink">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {dataDriven.columns.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-stroke">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="bg-surface-muted/70">
                        {dataDriven.columns.map((column) => (
                          <th key={column} className="border-b border-stroke px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataDriven.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t border-stroke">
                          {dataDriven.columns.map((column, colIndex) => (
                            <td key={`${rowIndex}-${column}`} className="px-2.5 py-2 text-sm text-ink">
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-stroke bg-surface-muted/35 p-3">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Request</p>
                  <div className="rounded-md border border-stroke bg-surface-elevated p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="danger" className="font-mono uppercase">{api.method || "METHOD"}</Badge>
                      <p className="break-all font-mono text-xs text-ink">{api.endpoint || "-"}</p>
                    </div>
                  </div>
                </div>
                <KeyValueList title="Headers" items={api.requestHeaders} />
                <KeyValueList title="Query Params" items={api.queryParams} />
                <CodeSurface title="Request Body" value={api.requestBody} />
              </div>

              <div className="space-y-3 rounded-lg border border-stroke bg-surface-muted/35 p-3">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Expected Response</p>
                  <div className="rounded-md border border-stroke bg-surface-elevated p-2.5">
                    <p className="text-xs font-semibold text-ink">
                      Status Code: <span className="font-mono">{api.expectedStatus || "-"}</span>
                    </p>
                  </div>
                </div>
                <KeyValueList title="Headers" items={api.expectedHeaders} />
                {api.assertions.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Assertions</p>
                    <ul className="space-y-1 rounded-md border border-stroke bg-surface-muted/30 p-2.5">
                      {api.assertions.map((assertion, index) => (
                        <li key={`${assertion}-${index}`} className="font-mono text-[11px] text-ink">
                          {assertion}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <CodeSurface title="Expected Body" value={api.expectedBody} />
              </div>
            </div>
          ) : null}
        </section>

        {(testCase.tags?.length ?? 0) > 0 ? (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-ink">Tags</h4>
            <div className="flex flex-wrap gap-1.5">
              {testCase.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-stroke bg-surface-muted/45 px-2 py-0.5 text-[10px] font-medium text-ink-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Sheet>
  );
}
