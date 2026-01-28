import type { GlobalRole, MemberRole } from "@/generated/prisma/client";

export type UserMembership = {
  projectId: string;
  projectKey: string;
  projectName: string;
  role: MemberRole;
};

export type UserRecord = {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  createdAt: string;
  globalRoles: GlobalRole[];
  memberships: UserMembership[];
};

export type UsersResponse = {
  items: UserRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type UserPayload = {
  email: string;
  fullName?: string | null;
  password: string;
  isActive: boolean;
  projectId: string;
  projectRole: "admin" | "editor" | "viewer";
};

export type UserUpdatePayload = {
  fullName?: string | null;
  password?: string;
  isActive: boolean;
  projectId: string;
  projectRole: "admin" | "editor" | "viewer";
};
