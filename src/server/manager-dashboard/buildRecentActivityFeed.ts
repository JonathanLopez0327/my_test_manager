import { formatRelativeTime } from "./helpers";
import type { RecentActivityItem } from "./types";

type BuildRecentActivityFeedInput = {
  runs: Array<{
    id: string;
    name: string | null;
    createdAt: Date;
    updatedAt?: Date | null;
  }>;
  bugs: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  testCases: Array<{
    id: string;
    title: string;
    updatedAt: Date;
  }>;
  testSuites: Array<{
    id: string;
    name: string;
    updatedAt: Date;
  }>;
  artifacts: Array<{
    id: string;
    name: string | null;
    createdAt: Date;
  }>;
  limit: number;
};

export function buildRecentActivityFeed({
  runs,
  bugs,
  testCases,
  testSuites,
  artifacts,
  limit,
}: BuildRecentActivityFeedInput): RecentActivityItem[] {
  const feed: RecentActivityItem[] = [];
  const seenKeys = new Set<string>();

  const MAX_PER_TYPE: Record<RecentActivityItem["type"], number> = {
    run: 3,
    bug: 3,
    test_case: 2,
    test_suite: 1,
    artifact: 1,
  };

  const typeCounts: Record<RecentActivityItem["type"], number> = {
    run: 0,
    bug: 0,
    test_case: 0,
    test_suite: 0,
    artifact: 0,
  };

  function tryPush(item: RecentActivityItem, dedupeKey: string) {
    if (typeCounts[item.type] >= MAX_PER_TYPE[item.type]) return;
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);
    typeCounts[item.type] += 1;
    feed.push(item);
  }

  for (const run of runs) {
    const timestamp = run.updatedAt ?? run.createdAt;
    tryPush({
      id: `run-${run.id}`,
      type: "run",
      title: "Manual run created",
      detail: run.name?.trim() || `Run ${run.id.slice(0, 8)}`,
      timestamp,
      when: formatRelativeTime(timestamp),
    }, `run:${run.id}`);
  }

  for (const bug of bugs) {
    tryPush({
      id: `bug-${bug.id}`,
      type: "bug",
      title: bug.updatedAt.getTime() > bug.createdAt.getTime() ? "Bug updated" : "Bug reported",
      detail: `${bug.id.slice(0, 8)} · ${bug.title} · ${bug.status}`,
      timestamp: bug.updatedAt,
      when: formatRelativeTime(bug.updatedAt),
    }, `bug:${bug.id}`);
  }

  for (const testCase of testCases) {
    tryPush({
      id: `case-${testCase.id}`,
      type: "test_case",
      title: "Test case updated",
      detail: testCase.title,
      timestamp: testCase.updatedAt,
      when: formatRelativeTime(testCase.updatedAt),
    }, `test_case:${testCase.title.toLowerCase()}`);
  }

  for (const suite of testSuites) {
    tryPush({
      id: `suite-${suite.id}`,
      type: "test_suite",
      title: "Test suite updated",
      detail: suite.name,
      timestamp: suite.updatedAt,
      when: formatRelativeTime(suite.updatedAt),
    }, `test_suite:${suite.name.toLowerCase()}`);
  }

  for (const artifact of artifacts) {
    tryPush({
      id: `artifact-${artifact.id}`,
      type: "artifact",
      title: "Artifact attached",
      detail: artifact.name?.trim() || `Artifact ${artifact.id.slice(0, 8)}`,
      timestamp: artifact.createdAt,
      when: formatRelativeTime(artifact.createdAt),
    }, `artifact:${artifact.name?.trim().toLowerCase() ?? artifact.id}`);
  }

  return feed
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}
