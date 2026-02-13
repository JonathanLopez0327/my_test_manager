"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import type { GlobalRole, OrgRole } from "@/generated/prisma/client";
import type { Permission } from "./permissions.constants";
import { canSync } from "./policy-engine";

/**
 * React hook that evaluates whether the current user has a permission.
 *
 * Uses the synchronous `canSync()` which checks global roles and org role
 * (no DB call). For project-scoped decisions in the UI, prefer
 * fetching the user's project role via API and checking locally.
 *
 * @example
 * ```tsx
 * const canCreate = useCan(PERMISSIONS.PROJECT_CREATE);
 * return canCreate ? <CreateButton /> : null;
 * ```
 */
export function useCan(permission: Permission): boolean {
    const { data: session } = useSession();
    const globalRoles = session?.user?.globalRoles as GlobalRole[] | undefined;
    const organizationRole = session?.user?.organizationRole as OrgRole | undefined;

    return useMemo(
        () => canSync(permission, globalRoles ?? [], organizationRole),
        [permission, globalRoles, organizationRole],
    );
}

/**
 * Hook that returns a `can` function for checking multiple permissions.
 *
 * @example
 * ```tsx
 * const { can } = usePermissions();
 * const canCreate = can(PERMISSIONS.PROJECT_CREATE);
 * const canDelete = can(PERMISSIONS.PROJECT_DELETE);
 * ```
 */
export function usePermissions() {
    const { data: session } = useSession();
    const globalRoles = (session?.user?.globalRoles as GlobalRole[] | undefined) ?? [];
    const organizationRole = session?.user?.organizationRole as OrgRole | undefined;
    const activeOrganizationId = session?.user?.activeOrganizationId as string | undefined;

    const can = useMemo(
        () => (permission: Permission) => canSync(permission, globalRoles, organizationRole),
        [globalRoles, organizationRole],
    );

    return { can, globalRoles, activeOrganizationId, organizationRole };
}
