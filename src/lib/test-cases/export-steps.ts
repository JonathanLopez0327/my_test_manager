import type { TestCaseStyle } from "@/generated/prisma/client";

type StepByStepItem = {
  step?: unknown;
  expectedResult?: unknown;
};

type GherkinItem = {
  keyword?: unknown;
  text?: unknown;
};

type DataDrivenItem = {
  template?: unknown;
  examples?: unknown;
};

type ApiItem = {
  request?: unknown;
  expectedResponse?: unknown;
};

type KeyValue = {
  key?: unknown;
  value?: unknown;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function summarizeSteps(style: TestCaseStyle, steps: unknown): string {
  switch (style) {
    case "step_by_step":
      return `${asArray<StepByStepItem>(steps).length} steps`;
    case "gherkin":
      return `${asArray<GherkinItem>(steps).length} clauses`;
    case "data_driven": {
      const data = isRecord(steps) ? (steps as DataDrivenItem) : {};
      const template = asArray<GherkinItem>(data.template);
      const examples = isRecord(data.examples) ? data.examples : {};
      const rows = asArray<unknown>((examples as { rows?: unknown }).rows);
      return `${template.length} clauses, ${rows.length} scenarios`;
    }
    case "api":
      return "API request/response";
    default:
      return "N/A";
  }
}

function formatStepByStepDetails(steps: unknown): string {
  const list = asArray<StepByStepItem>(steps);
  if (list.length === 0) return "No steps";

  return list
    .map((item, index) => {
      const step = asString(item.step, "(empty step)");
      const expected = asString(item.expectedResult, "(no expected result)");
      return `${index + 1}. ${step}\n   => ${expected}`;
    })
    .join("\n");
}

function formatGherkinDetails(steps: unknown): string {
  const clauses = asArray<GherkinItem>(steps);
  if (clauses.length === 0) return "No gherkin clauses";

  return clauses
    .map((item) => {
      const keyword = asString(item.keyword, "And");
      const text = asString(item.text, "(empty)");
      return `${keyword} ${text}`;
    })
    .join("\n");
}

function formatDataDrivenDetails(steps: unknown): string {
  if (!isRecord(steps)) return "No data-driven steps";

  const payload = steps as DataDrivenItem;
  const template = asArray<GherkinItem>(payload.template);
  const examples = isRecord(payload.examples) ? payload.examples : {};
  const columns = asArray<unknown>((examples as { columns?: unknown }).columns).map((column) =>
    asString(column, ""),
  );
  const rows = asArray<unknown>((examples as { rows?: unknown }).rows);

  const templateBlock =
    template.length > 0
      ? template
          .map((item) => `${asString(item.keyword, "And")} ${asString(item.text, "(empty)")}`)
          .join("\n")
      : "No template clauses";

  const rowsBlock =
    rows.length > 0
      ? rows
          .map((row, index) => {
            const values = asArray<unknown>(row).map((value) => asString(value, ""));
            return `${index + 1}. ${values.join(" | ")}`;
          })
          .join("\n")
      : "No example rows";

  return [
    "Template:",
    templateBlock,
    "",
    columns.length > 0 ? `Columns: ${columns.join(" | ")}` : "Columns: none",
    "Rows:",
    rowsBlock,
  ].join("\n");
}

function formatApiHeaders(value: unknown): string {
  const headers = asArray<KeyValue>(value);
  if (headers.length === 0) return "none";
  return headers
    .map((header) => `${asString(header.key, "(key)")}=${asString(header.value, "")}`)
    .join("; ");
}

function formatApiDetails(steps: unknown): string {
  if (!isRecord(steps)) return "No API details";
  const payload = steps as ApiItem;

  const request = isRecord(payload.request) ? payload.request : {};
  const response = isRecord(payload.expectedResponse) ? payload.expectedResponse : {};

  const requestMethod = asString((request as { method?: unknown }).method, "GET");
  const requestEndpoint = asString((request as { endpoint?: unknown }).endpoint, "/");
  const requestHeaders = formatApiHeaders((request as { headers?: unknown }).headers);
  const requestBody = asString((request as { body?: unknown }).body, "");

  const responseStatus = asString((response as { status?: unknown }).status, "");
  const responseHeaders = formatApiHeaders((response as { headers?: unknown }).headers);
  const responseBody = asString((response as { body?: unknown }).body, "");

  return [
    "Request:",
    `${requestMethod} ${requestEndpoint}`,
    `Headers: ${requestHeaders}`,
    `Body: ${requestBody || "(empty)"}`,
    "",
    "Expected response:",
    `Status: ${responseStatus || "(none)"}`,
    `Headers: ${responseHeaders}`,
    `Body: ${responseBody || "(empty)"}`,
  ].join("\n");
}

export function serializeTestCaseSteps(style: TestCaseStyle, steps: unknown): {
  summary: string;
  detail: string;
} {
  switch (style) {
    case "step_by_step":
      return {
        summary: summarizeSteps(style, steps),
        detail: formatStepByStepDetails(steps),
      };
    case "gherkin":
      return {
        summary: summarizeSteps(style, steps),
        detail: formatGherkinDetails(steps),
      };
    case "data_driven":
      return {
        summary: summarizeSteps(style, steps),
        detail: formatDataDrivenDetails(steps),
      };
    case "api":
      return {
        summary: summarizeSteps(style, steps),
        detail: formatApiDetails(steps),
      };
    default:
      return {
        summary: "N/A",
        detail: "Unsupported style",
      };
  }
}
