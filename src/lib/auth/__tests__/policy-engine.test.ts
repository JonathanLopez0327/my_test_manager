import {
    can,
    canSync,
    AuthorizationError,
    require as requirePermission,
} from "../policy-engine";
import { PERMISSIONS } from "../permissions.constants";
import type { GlobalRole } from "@/generated/prisma/client";
import type { PolicyContext } from "../policy-engine";

// Mock prisma
jest.mock("@/lib/prisma", () => ({
    prisma: {
        projectMember: {
            findUnique: jest.fn(),
        },
    },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require("@/lib/prisma");

describe("PolicyEngine", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ─── canSync (global roles only, no DB) ─────────────────

    describe("canSync", () => {
        it("super_admin should have all permissions", () => {
            const roles: GlobalRole[] = ["super_admin"];
            expect(canSync(PERMISSIONS.PROJECT_CREATE, roles)).toBe(true);
            expect(canSync(PERMISSIONS.PROJECT_DELETE, roles)).toBe(true);
            expect(canSync(PERMISSIONS.USER_CREATE, roles)).toBe(true);
            expect(canSync(PERMISSIONS.ARTIFACT_DELETE, roles)).toBe(true);
        });

        it("support should only have read permissions", () => {
            const roles: GlobalRole[] = ["support"];
            expect(canSync(PERMISSIONS.PROJECT_LIST, roles)).toBe(true);
            expect(canSync(PERMISSIONS.TEST_RUN_LIST, roles)).toBe(true);
            expect(canSync(PERMISSIONS.USER_LIST, roles)).toBe(true);
            // Should NOT have write permissions
            expect(canSync(PERMISSIONS.PROJECT_CREATE, roles)).toBe(false);
            expect(canSync(PERMISSIONS.PROJECT_DELETE, roles)).toBe(false);
            expect(canSync(PERMISSIONS.USER_CREATE, roles)).toBe(false);
        });

        it("auditor should only have read permissions", () => {
            const roles: GlobalRole[] = ["auditor"];
            expect(canSync(PERMISSIONS.PROJECT_LIST, roles)).toBe(true);
            expect(canSync(PERMISSIONS.ARTIFACT_LIST, roles)).toBe(true);
            // Should NOT have write permissions
            expect(canSync(PERMISSIONS.TEST_CASE_CREATE, roles)).toBe(false);
            expect(canSync(PERMISSIONS.TEST_RUN_DELETE, roles)).toBe(false);
        });

        it("empty roles should deny everything", () => {
            expect(canSync(PERMISSIONS.PROJECT_LIST, [])).toBe(false);
            expect(canSync(PERMISSIONS.PROJECT_CREATE, [])).toBe(false);
        });

        it("multiple global roles should combine", () => {
            const roles: GlobalRole[] = ["support", "super_admin"];
            expect(canSync(PERMISSIONS.PROJECT_CREATE, roles)).toBe(true);
            expect(canSync(PERMISSIONS.USER_CREATE, roles)).toBe(true);
        });
    });

    // ─── can (async, with project roles) ────────────────────

    describe("can", () => {
        const baseCtx: PolicyContext = {
            userId: "user-1",
            globalRoles: [],
        };

        it("should allow super_admin without project check", async () => {
            const ctx: PolicyContext = {
                ...baseCtx,
                globalRoles: ["super_admin"],
                projectId: "proj-1",
            };
            const result = await can(PERMISSIONS.TEST_SUITE_CREATE, ctx);
            expect(result).toBe(true);
            // Should NOT have queried project membership
            expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
        });

        it("should check project role when no global permission", async () => {
            prisma.projectMember.findUnique.mockResolvedValue({ role: "editor" });

            const ctx: PolicyContext = {
                ...baseCtx,
                globalRoles: [],
                projectId: "proj-1",
            };

            const result = await can(PERMISSIONS.TEST_SUITE_CREATE, ctx);
            expect(result).toBe(true);
            expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
                where: {
                    projectId_userId: { projectId: "proj-1", userId: "user-1" },
                },
                select: { role: true },
            });
        });

        it("should deny viewer for create permission", async () => {
            prisma.projectMember.findUnique.mockResolvedValue({ role: "viewer" });

            const ctx: PolicyContext = {
                ...baseCtx,
                globalRoles: [],
                projectId: "proj-1",
            };

            const result = await can(PERMISSIONS.TEST_SUITE_CREATE, ctx);
            expect(result).toBe(false);
        });

        it("should deny when not a member and no global role", async () => {
            prisma.projectMember.findUnique.mockResolvedValue(null);

            const ctx: PolicyContext = {
                ...baseCtx,
                globalRoles: [],
                projectId: "proj-1",
            };

            const result = await can(PERMISSIONS.TEST_PLAN_LIST, ctx);
            expect(result).toBe(false);
        });

        it("should allow project admin to delete", async () => {
            prisma.projectMember.findUnique.mockResolvedValue({ role: "admin" });

            const ctx: PolicyContext = {
                ...baseCtx,
                globalRoles: [],
                projectId: "proj-1",
            };

            const result = await can(PERMISSIONS.TEST_PLAN_DELETE, ctx);
            expect(result).toBe(true);
        });

        it("should deny project editor from deleting", async () => {
            prisma.projectMember.findUnique.mockResolvedValue({ role: "editor" });

            const ctx: PolicyContext = {
                ...baseCtx,
                globalRoles: [],
                projectId: "proj-1",
            };

            const result = await can(PERMISSIONS.TEST_PLAN_DELETE, ctx);
            expect(result).toBe(false);
        });

        it("readonly global role should list but not create", async () => {
            // When global role denies a permission and projectId is provided,
            // the engine falls through to check project role (which may also deny).
            prisma.projectMember.findUnique.mockResolvedValue(null);

            const ctx: PolicyContext = {
                ...baseCtx,
                globalRoles: ["support"],
                projectId: "proj-1",
            };

            expect(await can(PERMISSIONS.TEST_RUN_LIST, ctx)).toBe(true);
            expect(await can(PERMISSIONS.TEST_RUN_CREATE, ctx)).toBe(false);
        });
    });

    // ─── require ────────────────────────────────────────────

    describe("require", () => {
        it("should not throw when permission is granted", async () => {
            const ctx: PolicyContext = {
                userId: "user-1",
                globalRoles: ["super_admin"],
            };
            await expect(
                requirePermission(PERMISSIONS.USER_CREATE, ctx),
            ).resolves.toBeUndefined();
        });

        it("should throw AuthorizationError when denied", async () => {
            const ctx: PolicyContext = {
                userId: "user-1",
                globalRoles: ["auditor"],
            };
            await expect(
                requirePermission(PERMISSIONS.USER_CREATE, ctx),
            ).rejects.toThrow(AuthorizationError);
        });

        it("AuthorizationError should have statusCode 403", async () => {
            const ctx: PolicyContext = {
                userId: "user-1",
                globalRoles: [],
            };
            try {
                await requirePermission(PERMISSIONS.PROJECT_CREATE, ctx);
                fail("Should have thrown");
            } catch (error) {
                expect(error).toBeInstanceOf(AuthorizationError);
                expect((error as AuthorizationError).statusCode).toBe(403);
            }
        });
    });
});
