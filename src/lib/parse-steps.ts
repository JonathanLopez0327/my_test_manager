export type ParsedStep = {
  text: string;
  expected?: string | null;
};

export function parseSteps(style: string | undefined, steps: unknown): ParsedStep[] {
  if (!steps) return [];

  if (style === "step_by_step" && Array.isArray(steps)) {
    return steps
      .map((entry) => {
        if (typeof entry === "string") return { text: entry };
        if (!entry || typeof entry !== "object") return null;
        const value = entry as { step?: unknown; expectedResult?: unknown };
        return {
          text: typeof value.step === "string" ? value.step : "",
          expected: typeof value.expectedResult === "string" ? value.expectedResult : null,
        };
      })
      .filter((entry): entry is ParsedStep => Boolean(entry?.text?.trim()));
  }

  if (style === "gherkin" && Array.isArray(steps)) {
    return steps
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const value = entry as { keyword?: unknown; text?: unknown };
        const keyword = typeof value.keyword === "string" ? value.keyword : "";
        const text = typeof value.text === "string" ? value.text : "";
        return { text: `${keyword} ${text}`.trim() };
      })
      .filter((entry): entry is ParsedStep => Boolean(entry?.text?.trim()));
  }

  if (style === "data_driven" && typeof steps === "object" && steps !== null) {
    const value = steps as { template?: unknown };
    if (Array.isArray(value.template)) {
      return value.template
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const row = entry as { keyword?: unknown; text?: unknown };
          const keyword = typeof row.keyword === "string" ? row.keyword : "";
          const text = typeof row.text === "string" ? row.text : "";
          return { text: `${keyword} ${text}`.trim() };
        })
        .filter((entry): entry is ParsedStep => Boolean(entry?.text?.trim()));
    }
  }

  if (style === "api" && typeof steps === "object" && steps !== null) {
    const value = steps as {
      request?: { method?: unknown; endpoint?: unknown };
      expectedResponse?: { status?: unknown };
    };
    const method = typeof value.request?.method === "string" ? value.request.method : "REQUEST";
    const endpoint = typeof value.request?.endpoint === "string" ? value.request.endpoint : "/";
    const status = typeof value.expectedResponse?.status === "string" ? value.expectedResponse.status : "N/A";
    return [{ text: `${method} ${endpoint}`, expected: `Expected status ${status}` }];
  }

  if (Array.isArray(steps)) {
    return steps
      .map((entry) => (typeof entry === "string" ? { text: entry } : null))
      .filter((entry): entry is ParsedStep => Boolean(entry?.text?.trim()));
  }

  return [];
}
