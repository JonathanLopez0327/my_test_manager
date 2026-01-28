import { prisma } from "./prisma";
import { GlobalRole, MemberRole } from "@/generated/prisma/client";

const PROJECT_ROLE_ORDER: Record<MemberRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
};

export async function getGlobalRoles(userId: string): Promise<GlobalRole[]> {
  const roles = await prisma.userGlobalRole.findMany({
    where: { userId },
    select: { role: true },
  });
  return roles.map((item) => item.role);
}

export function isSuperAdmin(roles: GlobalRole[]) {
  return roles.includes("super_admin");
}

export function isReadOnlyGlobal(roles: GlobalRole[]) {
  return roles.includes("support") || roles.includes("auditor");
}

export async function getProjectRole(userId: string, projectId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    select: {
      role: true,
    },
  });
  return membership?.role ?? null;
}

export function hasProjectPermission(
  currentRole: MemberRole | null,
  requiredRole: MemberRole,
) {
  if (!currentRole) return false;
  return PROJECT_ROLE_ORDER[currentRole] >= PROJECT_ROLE_ORDER[requiredRole];
}

export async function isProjectAdmin(userId: string, projectId: string) {
  const role = await getProjectRole(userId, projectId);
  return role === "admin";
}

export async function canCreateProject(
  userId: string,
  globalRoles: GlobalRole[],
) {
  if (isSuperAdmin(globalRoles)) return true;
  if (isReadOnlyGlobal(globalRoles)) return false;
  const membership = await prisma.projectMember.findFirst({
    where: {
      userId,
      role: "admin",
    },
    select: { userId: true },
  });
  return Boolean(membership);
}
