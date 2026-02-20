export type TestCaseStatus = "draft" | "ready" | "deprecated";

export type TestCaseStyle = "step_by_step" | "gherkin" | "data_driven" | "api";

export type TestCaseStep = {
  step: string;
  expectedResult: string;
};

// BDD Gherkin
export type GherkinKeyword = "Given" | "When" | "Then" | "And";
export type GherkinClause = { keyword: GherkinKeyword; text: string };

// Data-driven
export type DataDrivenExamples = { columns: string[]; rows: string[][] };
export type DataDrivenSteps = { template: GherkinClause[]; examples: DataDrivenExamples };

// API-style
export type KeyValuePair = { key: string; value: string };
export type ApiRequest = { method: string; endpoint: string; headers: KeyValuePair[]; body: string };
export type ApiExpectedResponse = { status: string; body: string; headers: KeyValuePair[] };
export type ApiSteps = { request: ApiRequest; expectedResponse: ApiExpectedResponse };

export type TestCaseRecord = {
  id: string;
  suiteId: string;
  title: string;
  description: string | null;
  preconditions: string | null;
  style: TestCaseStyle;
  steps: TestCaseStep[] | string[];
  tags: string[];
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

export type TestCaseTagsResponse = {
  items: string[];
};

export type TestCasePayload = {
  suiteId: string;
  title: string;
  style?: TestCaseStyle;
  description?: string | null;
  preconditions?: string | null;
  steps?: unknown;
  tags?: string[];
  status: TestCaseStatus;
  priority?: number | null;
  isAutomated?: boolean;
  automationType?: string | null;
  automationRef?: string | null;
};
