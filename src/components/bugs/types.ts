export type SortDir = "asc" | "desc";
export type BugSortBy =
  | "bug"
  | "status"
  | "severity"
  | "type"
  | "priority"
  | "assignedTo"
  | "comments";

export type BugSeverity = "critical" | "high" | "medium" | "low";
export type BugStatus = "open" | "in_progress" | "resolved" | "verified" | "closed" | "reopened";
export type BugType = "bug" | "enhancement" | "task";

export type BugRecord = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  severity: BugSeverity;
  priority: number;
  status: BugStatus;
  type: BugType;
  assignedToId: string | null;
  reporterId: string | null;
  testRunItemId: string | null;
  testCaseId: string | null;
  reproductionSteps: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  environment: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    key: string;
    name: string;
  };
  assignedTo: { id: string; email: string; fullName: string | null } | null;
  reporter: { id: string; email: string; fullName: string | null } | null;
  testCase: { id: string; title: string } | null;
  _count?: { comments: number };
  comments?: BugCommentRecord[];
};

export type BugPayload = {
  projectId: string;
  title: string;
  description?: string | null;
  severity?: BugSeverity;
  priority?: number;
  status?: BugStatus;
  type?: BugType;
  assignedToId?: string | null;
  testRunItemId?: string | null;
  testCaseId?: string | null;
  reproductionSteps?: string | null;
  expectedResult?: string | null;
  actualResult?: string | null;
  environment?: string | null;
  tags?: string[];
};

export type BugCommentRecord = {
  id: string;
  bugId: string;
  authorId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; email: string; fullName: string | null } | null;
};

export type BugsResponse = {
  items: BugRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type BugStatsResponse = {
  total: number;
  byStatus: Record<BugStatus, number>;
  bySeverity: Record<BugSeverity, number>;
  byType: Record<BugType, number>;
};
