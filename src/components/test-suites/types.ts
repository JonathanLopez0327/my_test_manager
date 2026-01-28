export type TestSuiteRecord = {
  id: string;
  testPlanId: string;
  parentSuiteId: string | null;
  name: string;
  description: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  parent: {
    id: string;
    name: string;
  } | null;
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

export type TestSuitesResponse = {
  items: TestSuiteRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type TestSuitePayload = {
  testPlanId: string;
  parentSuiteId?: string | null;
  name: string;
  description?: string | null;
  displayOrder?: number | null;
};
