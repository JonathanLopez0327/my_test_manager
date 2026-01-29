import { isSuperAdmin, isReadOnlyGlobal, hasProjectPermission } from './permissions';
import { GlobalRole, MemberRole } from '@/generated/prisma/client';

// Mock prisma to avoid DB connection errors during tests
jest.mock('./prisma', () => ({
    prisma: {
        userGlobalRole: { findMany: jest.fn() },
        projectMember: { findUnique: jest.fn() },
    },
}));


describe('Permissions Utils', () => {
    describe('isSuperAdmin', () => {
        it('should return true if user has super_admin role', () => {
            expect(isSuperAdmin(['super_admin'])).toBe(true);
            expect(isSuperAdmin(['support', 'super_admin'])).toBe(true);
        });

        it('should return false if user does not have super_admin role', () => {
            expect(isSuperAdmin(['support'])).toBe(false);
            expect(isSuperAdmin([])).toBe(false);
        });
    });

    describe('isReadOnlyGlobal', () => {
        it('should return true for support role', () => {
            expect(isReadOnlyGlobal(['support'])).toBe(true);
        });

        it('should return true for auditor role', () => {
            expect(isReadOnlyGlobal(['auditor'])).toBe(true);
        });

        it('should return false for super_admin only', () => {
            expect(isReadOnlyGlobal(['super_admin'])).toBe(false);
        });
    });

    describe('hasProjectPermission', () => {
        it('should return true if current role is higher or equal to required', () => {
            expect(hasProjectPermission('admin', 'editor')).toBe(true);
            expect(hasProjectPermission('editor', 'viewer')).toBe(true);
            expect(hasProjectPermission('admin', 'admin')).toBe(true);
        });

        it('should return false if current role is lower than required', () => {
            expect(hasProjectPermission('viewer', 'editor')).toBe(false);
            expect(hasProjectPermission('editor', 'admin')).toBe(false);
        });

        it('should return false if current role is null', () => {
            expect(hasProjectPermission(null, 'viewer')).toBe(false);
        });
    });
});
