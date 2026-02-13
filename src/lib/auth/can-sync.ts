import type { GlobalRole, OrgRole } from "@/generated/prisma/client";
import type { Permission } from "./permissions.constants";
import {
    anyGlobalRoleHasPermission,
    orgRoleHasPermission,
} from "./role-permissions.map";

/**
 * Synchronous check using global roles and org role.
 * Suitable for UI show/hide decisions where we don't have project context
 * or need instant evaluation without async.
 *
 * NOTE: This does NOT check project roles. For project-scoped UI decisions,
 * the component should pass project membership data directly.
 *
 * This function lives in its own module (separate from policy-engine.ts)
 * so that client components can import it without pulling in Prisma.
 */
export function canSync(
    permission: Permission,
    globalRoles: GlobalRole[],
    organizationRole?: OrgRole,
): boolean {
    if (anyGlobalRoleHasPermission(globalRoles, permission)) {
        return true;
    }
    if (organizationRole && orgRoleHasPermission(organizationRole, permission)) {
        return true;
    }
    return false;
}
