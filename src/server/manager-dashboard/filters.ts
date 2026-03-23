export type DateRangePreset = "7d" | "30d" | "last5runs" | "last10runs" | "custom";

export type DashboardFilters = {
  projectId?: string;
  testPlanId?: string;
  suiteId?: string;
  range?: DateRangePreset;
  startDate?: string;
  endDate?: string;
};

const VALID_RANGES: ReadonlySet<string> = new Set<DateRangePreset>([
  "7d",
  "30d",
  "last5runs",
  "last10runs",
  "custom",
]);

/** Safely extract dashboard filters from URL search params. */
export function parseDashboardFilters(
  params: Record<string, string | string[] | undefined>,
): DashboardFilters {
  const str = (key: string): string | undefined => {
    const v = params[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    if (Array.isArray(v) && v.length > 0 && v[0].trim().length > 0) return v[0].trim();
    return undefined;
  };

  const range = str("range");

  return {
    projectId: str("projectId"),
    testPlanId: str("testPlanId"),
    suiteId: str("suiteId"),
    range: range && VALID_RANGES.has(range) ? (range as DateRangePreset) : undefined,
    startDate: str("startDate"),
    endDate: str("endDate"),
  };
}

const DEFAULT_RUN_LIMIT = 7;

/** Resolve how many recent runs to fetch based on the preset. */
export function resolveRunLimit(filters?: DashboardFilters): number {
  if (!filters?.range) return DEFAULT_RUN_LIMIT;
  if (filters.range === "last5runs") return 5;
  if (filters.range === "last10runs") return 10;
  return DEFAULT_RUN_LIMIT;
}

/**
 * Resolve a date range from the filter preset.
 * Returns `null` for run-count presets (last5runs / last10runs) since those
 * limit by number of runs, not by date.
 */
export function resolveDateRange(
  filters: DashboardFilters | undefined,
  now: Date,
): { gte?: Date; lte?: Date } | null {
  const range = filters?.range ?? "7d";

  switch (range) {
    case "7d": {
      const gte = new Date(now);
      gte.setDate(gte.getDate() - 6);
      gte.setHours(0, 0, 0, 0);
      return { gte };
    }
    case "30d": {
      const gte = new Date(now);
      gte.setDate(gte.getDate() - 29);
      gte.setHours(0, 0, 0, 0);
      return { gte };
    }
    case "custom": {
      const result: { gte?: Date; lte?: Date } = {};
      if (filters?.startDate) {
        result.gte = new Date(filters.startDate);
        result.gte.setHours(0, 0, 0, 0);
      }
      if (filters?.endDate) {
        result.lte = new Date(filters.endDate);
        result.lte.setHours(23, 59, 59, 999);
      }
      return result.gte || result.lte ? result : null;
    }
    case "last5runs":
    case "last10runs":
      return null;
    default:
      return null;
  }
}
