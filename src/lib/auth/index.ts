// ─────────────────────────────────────────────────────────────
// Barrel exports for src/lib/auth
// ─────────────────────────────────────────────────────────────

// Constants & types
export { PERMISSIONS, ALL_PERMISSIONS, READ_ONLY_PERMISSIONS } from "./permissions.constants";
export type { Permission } from "./permissions.constants";

// Role → Permission maps
export {
    GLOBAL_ROLE_PERMISSIONS,
    PROJECT_ROLE_PERMISSIONS,
    globalRoleHasPermission,
    projectRoleHasPermission,
    anyGlobalRoleHasPermission,
} from "./role-permissions.map";

// Policy engine
export {
    can,
    require,
    canSync,
    AuthorizationError,
} from "./policy-engine";
export type { PolicyContext } from "./policy-engine";

// API helper
export { withAuth } from "./with-auth";
export type { AuthContext } from "./with-auth";

// Run-level permission helper
export { requireRunPermission } from "./require-run-permission";

// React hooks
export { useCan, usePermissions } from "./use-can";
