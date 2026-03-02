export type SortDir = "asc" | "desc";
export type TestPlanSortBy =
  | "name"
  | "project"
  | "status"
  | "startsOn"
  | "endsOn";

export type TestPlanStatus = "draft" | "active" | "completed" | "archived";

export type TestPlanRecord = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: TestPlanStatus;
  startsOn: string | null;
  endsOn: string | null;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    key: string;
    name: string;
  };
};

export type TestPlansResponse = {
  items: TestPlanRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type TestPlanPayload = {
  projectId: string;
  name: string;
  description?: string | null;
  status: TestPlanStatus;
  startsOn?: string | null;
  endsOn?: string | null;
};
