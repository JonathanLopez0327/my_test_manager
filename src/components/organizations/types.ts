import type { OrgRole } from "@/generated/prisma/client";

export type OrganizationRecord = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    members: number;
    projects: number;
  };
};

export type OrganizationDetail = OrganizationRecord & {
  createdBy: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
};

export type OrganizationsResponse = {
  items: OrganizationRecord[];
};

export type OrganizationCreatePayload = {
  slug: string;
  name: string;
};

export type OrganizationUpdatePayload = {
  name?: string;
  slug?: string;
  isActive?: boolean;
};

export type MemberRecord = {
  organizationId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    isActive: boolean;
  };
};

export type MembersResponse = {
  items: MemberRecord[];
};

export type AddMemberPayload = {
  userId: string;
  role: OrgRole;
};

export type UpdateMemberPayload = {
  role: OrgRole;
};
