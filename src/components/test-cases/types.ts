export type TestCaseStatus = "draft" | "ready" | "deprecated";

export type TestCaseRecord = {
  id: string;
  suiteId: string;
  title: string;
  description: string | null;
  preconditions: string | null;
  steps: string[];
  status: TestCaseStatus;
  isAutomated: boolean;
  automationType: string | null;
  automationRef: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
  suite: {
    id: string;
    name: string;
    testPlan: {
      id: string;
      name: string;
      project: {
        id: string;
        key: string;
        name: string;
      };
    };
  };
};

export type TestCasesResponse = {
  items: TestCaseRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type TestCasePayload = {
  suiteId: string;
  title: string;
  description?: string | null;
  preconditions?: string | null;
  steps?: string[] | null;
  status: TestCaseStatus;
  priority?: number | null;
  isAutomated?: boolean;
  automationType?: string | null;
  automationRef?: string | null;
};
