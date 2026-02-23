export type ProjectRecord = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  context: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectsResponse = {
  items: ProjectRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProjectPayload = {
  key: string;
  name: string;
  description?: string | null;
  context?: string | null;
  isActive: boolean;
};
