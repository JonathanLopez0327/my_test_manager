import type { TestCaseStyle as PrismaTestCaseStyle } from "@/generated/prisma/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any;

const VALID_STYLES: PrismaTestCaseStyle[] = ["step_by_step", "gherkin", "data_driven", "api"];
const GHERKIN_KEYWORDS = ["Given", "When", "Then", "And"] as const;
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

export function parseStyle(value?: string | null): PrismaTestCaseStyle {
  if (value && VALID_STYLES.includes(value as PrismaTestCaseStyle)) {
    return value as PrismaTestCaseStyle;
  }
  return "step_by_step";
}

export function normalizeSteps(value: unknown, style: PrismaTestCaseStyle): JsonValue {
  switch (style) {
    case "step_by_step":
      return normalizeStepByStep(value);
    case "gherkin":
      return normalizeGherkin(value);
    case "data_driven":
      return normalizeDataDriven(value);
    case "api":
      return normalizeApi(value);
    default:
      return normalizeStepByStep(value);
  }
}

function normalizeStepByStep(value: unknown): { step: string; expectedResult: string }[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const step = (item as any).step;
          const expectedResult = (item as any).expectedResult;
          if (typeof step === "string" || typeof expectedResult === "string") {
            return {
              step: String(step ?? "").trim(),
              expectedResult: String(expectedResult ?? "").trim(),
            };
          }
        }
        return { step: String(item).trim(), expectedResult: "" };
      })
      .filter((item) => item.step || item.expectedResult);
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => ({ step: line, expectedResult: "" }));
  }
  return [];
}

function normalizeGherkin(value: unknown): { keyword: string; text: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { keyword: string; text: string } => {
      if (typeof item !== "object" || item === null) return false;
      const { keyword, text } = item as any;
      return typeof keyword === "string" && typeof text === "string";
    })
    .map((item) => ({
      keyword: GHERKIN_KEYWORDS.includes(item.keyword as any)
        ? item.keyword
        : "Given",
      text: item.text.trim(),
    }))
    .filter((item) => item.text.length > 0);
}

function normalizeDataDriven(value: unknown): {
  template: { keyword: string; text: string }[];
  examples: { columns: string[]; rows: string[][] };
} {
  const fallback = { template: [], examples: { columns: [], rows: [] } };
  if (typeof value !== "object" || value === null) return fallback;

  const obj = value as any;
  const template = normalizeGherkin(obj.template);

  const examples = obj.examples;
  if (typeof examples !== "object" || examples === null) {
    return { template, examples: { columns: [], rows: [] } };
  }

  const columns = Array.isArray(examples.columns)
    ? examples.columns.filter((c: unknown): c is string => typeof c === "string").map((c: string) => c.trim())
    : [];

  const rows = Array.isArray(examples.rows)
    ? examples.rows
        .filter((r: unknown): r is string[] => Array.isArray(r))
        .map((r: string[]) => r.map((cell) => String(cell ?? "").trim()))
    : [];

  return { template, examples: { columns, rows } };
}

function normalizeApi(value: unknown): {
  request: { method: string; endpoint: string; headers: { key: string; value: string }[]; body: string };
  expectedResponse: { status: string; body: string; headers: { key: string; value: string }[] };
} {
  const fallback = {
    request: { method: "GET", endpoint: "", headers: [], body: "" },
    expectedResponse: { status: "", body: "", headers: [] },
  };
  if (typeof value !== "object" || value === null) return fallback;

  const obj = value as any;

  const req = typeof obj.request === "object" && obj.request !== null ? obj.request : {};
  const method = HTTP_METHODS.includes(String(req.method ?? "").toUpperCase() as any)
    ? String(req.method).toUpperCase()
    : "GET";

  const res = typeof obj.expectedResponse === "object" && obj.expectedResponse !== null ? obj.expectedResponse : {};

  return {
    request: {
      method,
      endpoint: String(req.endpoint ?? "").trim(),
      headers: normalizeKeyValuePairs(req.headers),
      body: String(req.body ?? "").trim(),
    },
    expectedResponse: {
      status: String(res.status ?? "").trim(),
      body: String(res.body ?? "").trim(),
      headers: normalizeKeyValuePairs(res.headers),
    },
  };
}

function normalizeKeyValuePairs(value: unknown): { key: string; value: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { key: string; value: string } => {
      if (typeof item !== "object" || item === null) return false;
      return typeof (item as any).key === "string";
    })
    .map((item) => ({
      key: item.key.trim(),
      value: String((item as any).value ?? "").trim(),
    }))
    .filter((item) => item.key.length > 0);
}
