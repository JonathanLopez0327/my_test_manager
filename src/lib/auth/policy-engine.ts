import type { GlobalRole, MemberRole, OrgRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Permission } from "./permissions.constants";
import {
    anyGlobalRoleHasPermission,
    orgRoleHasPermission,
    projectRoleHasPermission,
} from "./role-permissions.map";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type PolicyContext = {
    /** Current user ID */
    userId: string;
    /** Global roles from the JWT / session */
    globalRoles: GlobalRole[];
    /** Active organization ID from the session */
    organizationId?: string;
    /** Organization role from the session */
    organizationRole?: OrgRole;
    /** Project ID — required for project-scoped permissions */
    projectId?: string;
    /** Resource owner ID — for ownership-based rules */
    resourceOwnerId?: string;
};

// ─────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────

export class AuthorizationError extends Error {
    public readonly statusCode = 403;

    constructor(permission: Permission, message?: string) {
        super(
            message ??
            `No tienes permisos para realizar esta acción (${permission}).`,
        );
        this.name = "AuthorizationError";
    }
}

// ─────────────────────────────────────────────────────────────
// Core: can()
// ─────────────────────────────────────────────────────────────

/**
 * The single authorization decision point.
 *
 * Evaluation order:
 * 1. Global roles — if any grants the permission → allowed
 * 2. Org roles — if `organizationRole` is owner/admin, grant implicit
 *    project admin access for all projects in the org
 * 3. Project roles — if `projectId` is provided, check membership
 * 4. Ownership rules — if `resourceOwnerId` matches `userId` and
 *    the user has at least viewer access → allowed for update
 *
 * @returns `true` if allowed, `false` otherwise.
 */
export async function can(
    permission: Permission,
    ctx: PolicyContext,
): Promise<boolean> {
    // 1. Global role check (fast, no DB query)
    if (anyGlobalRoleHasPermission(ctx.globalRoles, permission)) {
        return true;
    }

    // 2. Org role check — owner/admin get implicit project admin access
    if (ctx.organizationRole && orgRoleHasPermission(ctx.organizationRole, permission)) {
        return true;
    }

    // 3. Project-scoped check
    if (ctx.projectId) {
        const projectRole = await getProjectRole(ctx.userId, ctx.projectId);
        if (projectRole && projectRoleHasPermission(projectRole, permission)) {
            return true;
        }
    }

    // 4. Ownership rule (creator can update their own resources)
    if (
        ctx.resourceOwnerId &&
        ctx.resourceOwnerId === ctx.userId &&
        permission.endsWith(":update")
    ) {
        // Owner has implicit update permission on their own resource
        // as long as they have at least viewer access to the project
        if (ctx.projectId) {
            const projectRole = await getProjectRole(ctx.userId, ctx.projectId);
            if (projectRole) return true;
        }
    }

    return false;
}

// ─────────────────────────────────────────────────────────────
// Core: require()
// ─────────────────────────────────────────────────────────────

/**
 * Same as `can()` but throws `AuthorizationError` when denied.
 * Designed for API routes where a 403 response is the desired outcome.
 */
export async function require(
    permission: Permission,
    ctx: PolicyContext,
): Promise<void> {
    const allowed = await can(permission, ctx);
    if (!allowed) {
        throw new AuthorizationError(permission);
    }
}

// Re-export canSync from its dedicated module so server-side callers
// that already import from policy-engine are not broken.
export { canSync } from "./can-sync";

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

async function getProjectRole(
    userId: string,
    projectId: string,
): Promise<MemberRole | null> {
    const membership = await prisma.projectMember.findUnique({
        where: {
            projectId_userId: { projectId, userId },
        },
        select: { role: true },
    });
    return membership?.role ?? null;
}
