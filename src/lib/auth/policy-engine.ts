import type { GlobalRole, MemberRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Permission } from "./permissions.constants";
import {
    anyGlobalRoleHasPermission,
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
 * 2. Project roles — if `projectId` is provided, check membership
 * 3. Ownership rules — if `resourceOwnerId` matches `userId` and
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

    // 2. Project-scoped check
    if (ctx.projectId) {
        const projectRole = await getProjectRole(ctx.userId, ctx.projectId);
        if (projectRole && projectRoleHasPermission(projectRole, permission)) {
            return true;
        }
    }

    // 3. Ownership rule (creator can update their own resources)
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

// ─────────────────────────────────────────────────────────────
// Core: canSync() — for client-side (no DB, global roles only)
// ─────────────────────────────────────────────────────────────

/**
 * Synchronous check using only global roles.
 * Suitable for UI show/hide decisions where we don't have project context
 * or need instant evaluation without async.
 *
 * NOTE: This does NOT check project roles. For project-scoped UI decisions,
 * the component should pass project membership data directly.
 */
export function canSync(
    permission: Permission,
    globalRoles: GlobalRole[],
): boolean {
    return anyGlobalRoleHasPermission(globalRoles, permission);
}

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
