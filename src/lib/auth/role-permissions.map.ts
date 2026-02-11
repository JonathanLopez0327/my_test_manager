import type { GlobalRole, MemberRole } from "@/generated/prisma/client";
import {
    ALL_PERMISSIONS,
    READ_ONLY_PERMISSIONS,
    PERMISSIONS,
    type Permission,
} from "./permissions.constants";

// ─────────────────────────────────────────────────────────────
// Global-role permission maps
// ─────────────────────────────────────────────────────────────

/** super_admin gets every permission */
const SUPER_ADMIN_PERMISSIONS: ReadonlySet<Permission> = new Set(ALL_PERMISSIONS);

/** support & auditor only get read-only permissions */
const READONLY_GLOBAL_PERMISSIONS: ReadonlySet<Permission> = new Set(READ_ONLY_PERMISSIONS);

export const GLOBAL_ROLE_PERMISSIONS: Record<GlobalRole, ReadonlySet<Permission>> = {
    super_admin: SUPER_ADMIN_PERMISSIONS,
    support: READONLY_GLOBAL_PERMISSIONS,
    auditor: READONLY_GLOBAL_PERMISSIONS,
};

// ─────────────────────────────────────────────────────────────
// Project-role permission maps (scoped to a project)
// ─────────────────────────────────────────────────────────────

const PROJECT_VIEWER_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
    PERMISSIONS.PROJECT_LIST,
    PERMISSIONS.TEST_PLAN_LIST,
    PERMISSIONS.TEST_SUITE_LIST,
    PERMISSIONS.TEST_CASE_LIST,
    PERMISSIONS.TEST_RUN_LIST,
    PERMISSIONS.TEST_RUN_ITEM_LIST,
    PERMISSIONS.TEST_RUN_METRICS_VIEW,
    PERMISSIONS.ARTIFACT_LIST,
]);

const PROJECT_EDITOR_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
    // Inherits viewer
    ...PROJECT_VIEWER_PERMISSIONS,
    // Create & update
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.TEST_PLAN_CREATE,
    PERMISSIONS.TEST_PLAN_UPDATE,
    PERMISSIONS.TEST_SUITE_CREATE,
    PERMISSIONS.TEST_SUITE_UPDATE,
    PERMISSIONS.TEST_CASE_CREATE,
    PERMISSIONS.TEST_CASE_UPDATE,
    PERMISSIONS.TEST_RUN_CREATE,
    PERMISSIONS.TEST_RUN_UPDATE,
    PERMISSIONS.TEST_RUN_ITEM_UPDATE,
    PERMISSIONS.TEST_RUN_METRICS_UPDATE,
    PERMISSIONS.ARTIFACT_UPLOAD,
]);

const PROJECT_ADMIN_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
    // Inherits editor
    ...PROJECT_EDITOR_PERMISSIONS,
    // Delete
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.TEST_PLAN_DELETE,
    PERMISSIONS.TEST_SUITE_DELETE,
    PERMISSIONS.TEST_CASE_DELETE,
    PERMISSIONS.TEST_RUN_DELETE,
    PERMISSIONS.ARTIFACT_DELETE,
]);

export const PROJECT_ROLE_PERMISSIONS: Record<MemberRole, ReadonlySet<Permission>> = {
    viewer: PROJECT_VIEWER_PERMISSIONS,
    editor: PROJECT_EDITOR_PERMISSIONS,
    admin: PROJECT_ADMIN_PERMISSIONS,
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Check if a global role grants a specific permission.
 */
export function globalRoleHasPermission(role: GlobalRole, permission: Permission): boolean {
    return GLOBAL_ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Check if a project role grants a specific permission.
 */
export function projectRoleHasPermission(role: MemberRole, permission: Permission): boolean {
    return PROJECT_ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Check if any of the given global roles grants a specific permission.
 */
export function anyGlobalRoleHasPermission(
    roles: GlobalRole[],
    permission: Permission,
): boolean {
    return roles.some((role) => globalRoleHasPermission(role, permission));
}
