export type SortDir = "asc" | "desc";
export type TestRunSortBy =
  | "run"
  | "project"
  | "planSuite"
  | "status"
  | "metrics"
  | "runType"
  | "dates";

export type TestRunType = "manual" | "automated";

export type TestRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "canceled"
  | "failed";

export type TestRunRecord = {
  id: string;
  projectId: string;
  testPlanId: string | null;
  suiteId: string | null;
  runType: TestRunType;
  status: TestRunStatus;
  name: string | null;
  environment: string | null;
  buildNumber: string | null;
  branch: string | null;
  commitSha: string | null;
  ciProvider: string | null;
  ciRunUrl: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  project: {
    id: string;
    key: string;
    name: string;
  };
  testPlan: {
    id: string;
    name: string;
  } | null;
  suite: {
    id: string;
    name: string;
    testPlan: {
      id: string;
      name: string;
    };
  } | null;
  triggeredBy: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
  metrics?: TestRunMetricsRecord | null;
};

export type TestRunMetricsRecord = {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  blocked: number;
  notRun: number;
  passRate: string;
  durationMs: string | null;
  createdAt: string;
};

export type TestRunsResponse = {
  items: TestRunRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type TestRunPayload = {
  projectId: string;
  testPlanId?: string | null;
  suiteId?: string | null;
  runType: TestRunType;
  status: TestRunStatus;
  name?: string | null;
  environment?: string | null;
  buildNumber?: string | null;
  branch?: string | null;
  commitSha?: string | null;
  ciProvider?: string | null;
  ciRunUrl?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createItems?: boolean;
};
