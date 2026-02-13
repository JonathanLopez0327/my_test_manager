import type { GlobalRole, OrgRole } from "@/generated/prisma/client";

export type UserMembership = {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  role: OrgRole;
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
  memberships: {
    organizationId: string;
    role: OrgRole;
  }[];
};

export type UserUpdatePayload = {
  fullName?: string | null;
  password?: string;
  isActive: boolean;
  memberships: {
    organizationId: string;
    role: OrgRole;
  }[];
};
