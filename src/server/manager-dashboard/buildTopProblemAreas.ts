import type { TopProblemAreaSuite, TopProblemAreaTestCase } from "./types";

type FailedItem = {
  suiteName: string | null;
};

type BugLinkedCase = {
  testCaseId: string;
  testCaseTitle: string;
};

type BuildTopProblemAreasInput = {
  failedItems: FailedItem[];
  bugsLinkedCases: BugLinkedCase[];
};

export function buildTopProblemAreas({
  failedItems,
  bugsLinkedCases,
}: BuildTopProblemAreasInput): {
  suites: TopProblemAreaSuite[];
  testCases: TopProblemAreaTestCase[];
} {
  const suiteFailures = new Map<string, number>();
  for (const item of failedItems) {
    if (!item.suiteName) continue;
    suiteFailures.set(item.suiteName, (suiteFailures.get(item.suiteName) ?? 0) + 1);
  }

  const testCaseBugs = new Map<string, TopProblemAreaTestCase>();
  for (const row of bugsLinkedCases) {
    const key = row.testCaseId;
    const existing = testCaseBugs.get(key);
    if (!existing) {
      testCaseBugs.set(key, {
        testCaseId: row.testCaseId,
        testCaseTitle: row.testCaseTitle,
        linkedBugs: 1,
      });
      continue;
    }
    existing.linkedBugs += 1;
  }

  const suites = Array.from(suiteFailures.entries())
    .map(([suiteName, failedCount]) => ({ suiteName, failedCount }))
    .sort((a, b) => b.failedCount - a.failedCount)
    .slice(0, 5);

  const testCases = Array.from(testCaseBugs.values())
    .sort((a, b) => b.linkedBugs - a.linkedBugs)
    .slice(0, 5);

  return { suites, testCases };
}
