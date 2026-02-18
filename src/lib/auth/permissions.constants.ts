/**
 * Typed permission constants for the entire application.
 * Format: "resource:action"
 *
 * These represent ACTIONS, not routes. They are the single source of truth
 * for what can be authorized in the system.
 */
export const PERMISSIONS = {
  // ── Projects ──────────────────────────────────────────────
  PROJECT_LIST: "project:list",
  PROJECT_CREATE: "project:create",
  PROJECT_UPDATE: "project:update",
  PROJECT_DELETE: "project:delete",

  // ── Test Plans ────────────────────────────────────────────
  TEST_PLAN_LIST: "test-plan:list",
  TEST_PLAN_CREATE: "test-plan:create",
  TEST_PLAN_UPDATE: "test-plan:update",
  TEST_PLAN_DELETE: "test-plan:delete",

  // ── Test Suites ───────────────────────────────────────────
  TEST_SUITE_LIST: "test-suite:list",
  TEST_SUITE_CREATE: "test-suite:create",
  TEST_SUITE_UPDATE: "test-suite:update",
  TEST_SUITE_DELETE: "test-suite:delete",

  // ── Test Cases ────────────────────────────────────────────
  TEST_CASE_LIST: "test-case:list",
  TEST_CASE_CREATE: "test-case:create",
  TEST_CASE_UPDATE: "test-case:update",
  TEST_CASE_DELETE: "test-case:delete",

  // ── Test Runs ─────────────────────────────────────────────
  TEST_RUN_LIST: "test-run:list",
  TEST_RUN_CREATE: "test-run:create",
  TEST_RUN_UPDATE: "test-run:update",
  TEST_RUN_DELETE: "test-run:delete",

  // ── Test Run Items ────────────────────────────────────────
  TEST_RUN_ITEM_LIST: "test-run-item:list",
  TEST_RUN_ITEM_UPDATE: "test-run-item:update",

  // ── Test Run Metrics ──────────────────────────────────────
  TEST_RUN_METRICS_VIEW: "test-run-metrics:view",
  TEST_RUN_METRICS_UPDATE: "test-run-metrics:update",

  // ── Artifacts ─────────────────────────────────────────────
  ARTIFACT_LIST: "artifact:list",
  ARTIFACT_UPLOAD: "artifact:upload",
  ARTIFACT_DELETE: "artifact:delete",

  // ── Users (admin-only) ────────────────────────────────────
  USER_LIST: "user:list",
  USER_CREATE: "user:create",
  USER_UPDATE: "user:update",

  // ── Bugs ─────────────────────────────────────────────────────
  BUG_LIST: "bug:list",
  BUG_CREATE: "bug:create",
  BUG_UPDATE: "bug:update",
  BUG_DELETE: "bug:delete",
  BUG_COMMENT_CREATE: "bug-comment:create",
  BUG_COMMENT_DELETE: "bug-comment:delete",

  // ── Organizations ───────────────────────────────────────────
  ORG_LIST: "org:list",
  ORG_CREATE: "org:create",
  ORG_UPDATE: "org:update",
  ORG_DELETE: "org:delete",
  ORG_MEMBER_LIST: "org-member:list",
  ORG_MEMBER_MANAGE: "org-member:manage",
} as const;

/** Union type of all permission strings */
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Array of every permission value (useful for "grant all") */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/**
 * Permissions that only grant read/list access.
 * Used to build the readonly role maps.
 */
export const READ_ONLY_PERMISSIONS: Permission[] = [
  PERMISSIONS.PROJECT_LIST,
  PERMISSIONS.TEST_PLAN_LIST,
  PERMISSIONS.TEST_SUITE_LIST,
  PERMISSIONS.TEST_CASE_LIST,
  PERMISSIONS.TEST_RUN_LIST,
  PERMISSIONS.TEST_RUN_ITEM_LIST,
  PERMISSIONS.TEST_RUN_METRICS_VIEW,
  PERMISSIONS.ARTIFACT_LIST,
  PERMISSIONS.BUG_LIST,
  PERMISSIONS.USER_LIST,
];
