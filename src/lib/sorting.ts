export type SortDir = "asc" | "desc";

export function parseSortDir(
  value: string | null | undefined,
  fallback: SortDir,
): SortDir {
  if (value === "asc" || value === "desc") return value;
  return fallback;
}

export function parseSortBy<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value && allowed.includes(value as T)) return value as T;
  return fallback;
}

export function nextSort<T extends string>(
  currentKey: T | null,
  currentDir: SortDir | null,
  clickedKey: T,
): { sortBy: T; sortDir: SortDir } | null {
  if (currentKey !== clickedKey) {
    return { sortBy: clickedKey, sortDir: "asc" };
  }
  if (currentDir === "asc") {
    return { sortBy: clickedKey, sortDir: "desc" };
  }
  return null;
}
