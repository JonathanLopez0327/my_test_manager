import type { GlobalRole, OrgRole } from "@/generated/prisma/client";
import type { Permission } from "./permissions.constants";
import {
    anyGlobalRoleHasPermission,
    orgRoleHasPermission,
    PROJECT_ROLE_PERMISSIONS,
} from "./role-permissions.map";

const PROJECT_GRANTED_PERMISSIONS: ReadonlySet<Permission> = new Set(
    Object.values(PROJECT_ROLE_PERMISSIONS).flatMap((set) => Array.from(set)),
);

/**
 * Synchronous check using global roles, org role, and (optionally) project
 * access. Suitable for UI show/hide decisions in nav-level gates.
 *
 * When `hasProjectAccess` is true, permissions granted by ANY project role
 * (viewer/editor/admin) resolve to true — enough signal for "should this user
 * see the nav item at all?" decisions. Per-project gating must still happen
 * server-side via `policy-engine.can()`.
 */
export function canSync(
    permission: Permission,
    globalRoles: GlobalRole[],
    organizationRole?: OrgRole,
    hasProjectAccess = false,
): boolean {
    if (anyGlobalRoleHasPermission(globalRoles, permission)) {
        return true;
    }
    if (organizationRole && orgRoleHasPermission(organizationRole, permission)) {
        return true;
    }
    if (hasProjectAccess && PROJECT_GRANTED_PERMISSIONS.has(permission)) {
        return true;
    }
    return false;
}


