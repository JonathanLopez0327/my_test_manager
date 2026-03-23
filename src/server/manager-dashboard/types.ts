export type RunStatusTone = "success" | "danger" | "warning" | "neutral";

export type RunSummaryItem = {
  id: string;
  title: string;
  suite: string;
  environment: string;
  when: string;
  duration: string;
  tests: string;
  outcome: string;
  status: string;
  tone: RunStatusTone;
  failedCount: number;
};

export type StatusSlice = {
  name: string;
  value: number;
  color: string;
  percentage: number;
};

export type TrendPoint = {
  label: string;
  passRate: number;
  runName: string;
};

export type HeaderKpi = {
  id: string;
  label: string;
  value: string;
  microcopy: string;
  tone: "success" | "danger" | "warning" | "neutral";
};

export type NeedsAttentionSignal = {
  id: string;
  title: string;
  detail: string;
  cta: string;
  tone: "danger" | "warning" | "info";
};

export type TopProblemAreaSuite = {
  suiteName: string;
  failedCount: number;
};

export type TopProblemAreaTestCase = {
  testCaseId: string;
  testCaseTitle: string;
  linkedBugs: number;
};

export type RecentBugItem = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved" | "verified" | "closed" | "reopened";
  createdAt: Date;
};

export type RecentActivityItem = {
  id: string;
  type: "run" | "bug" | "test_case" | "test_suite" | "artifact";
  title: string;
  detail: string;
  when: string;
  timestamp: Date;
};

export type ManagerDashboardData = {
  header: HeaderKpi[];
  latestRunHealth: {
    totalExecuted: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    notRun: number;
    passRate: number;
    latestRunName: string;
    latestRunWhen: string;
    deltaVsPreviousRun: number | null;
  };
  defectRisk: {
    openBugs: number;
    openCriticalHigh: number;
    linkedToLatestRun: number;
    summary: string;
  };
  coverageReadiness: {
    totalTestCases: number;
    ready: number;
    draft: number;
    deprecated: number;
    readyRate: number;
    readyWithoutRecentExecution: number;
  };
  executionActivity: {
    runsThisWeek: number;
    executedCasesThisWeek: number;
    lastRunDate: string;
  };
  trend: {
    data: TrendPoint[];
    summary: string;
    subtitle: string;
  };
  latestRunDistribution: {
    data: StatusSlice[];
    total: number;
    passRate: number;
    runLabel: string;
  };
  needsAttention: NeedsAttentionSignal[];
  topProblemAreas: {
    suites: TopProblemAreaSuite[];
    testCases: TopProblemAreaTestCase[];
  };
  latestRuns: RunSummaryItem[];
  recentBugs: RecentBugItem[];
  recentActivity: RecentActivityItem[];
};
