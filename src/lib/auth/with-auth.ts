import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { GlobalRole, OrgRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import type { Permission } from "./permissions.constants";
import { AuthorizationError, require as requirePermission } from "./policy-engine";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type AuthContext = {
    session: {
        user: {
            id: string;
            globalRoles: GlobalRole[];
            activeOrganizationId?: string;
            organizationRole?: OrgRole;
            name?: string | null;
            email?: string | null;
        };
    };
    userId: string;
    globalRoles: GlobalRole[];
    activeOrganizationId?: string;
    organizationRole?: OrgRole;
};

type RouteContext = {
    params: Promise<Record<string, string>>;
};

type AuthenticatedHandler = (
    req: NextRequest,
    ctx: AuthContext,
    routeCtx: RouteContext,
) => Promise<NextResponse>;

// ─────────────────────────────────────────────────────────────
// withAuth — API route wrapper
// ─────────────────────────────────────────────────────────────

/**
 * Wraps an API route handler with authentication and optional
 * permission checks.
 *
 * @example
 * ```ts
 * // Just authentication (no specific permission)
 * export const GET = withAuth(null, async (req, { userId }) => {
 *   // ...
 * });
 *
 * // With permission check
 * export const POST = withAuth(PERMISSIONS.PROJECT_CREATE, async (req, { userId }) => {
 *   // ...
 * });
 * ```
 */
export function withAuth(
    permission: Permission | null,
    handler: AuthenticatedHandler,
) {
    return async (req: NextRequest, routeCtx: RouteContext) => {
        try {
            const session = await getServerSession(authOptions);

            if (!session?.user?.id) {
                return NextResponse.json(
                    { message: "No autorizado." },
                    { status: 401 },
                );
            }

            const userId = session.user.id;
            const globalRoles = (session.user.globalRoles ?? []) as GlobalRole[];
            const activeOrganizationId = session.user.activeOrganizationId as string | undefined;
            const organizationRole = session.user.organizationRole as OrgRole | undefined;

            // If a specific permission is required, check it
            if (permission) {
                await requirePermission(permission, {
                    userId,
                    globalRoles,
                    organizationId: activeOrganizationId,
                    organizationRole,
                });
            }

            const authCtx: AuthContext = {
                session: {
                    user: {
                        id: userId,
                        globalRoles,
                        activeOrganizationId,
                        organizationRole,
                        name: session.user.name,
                        email: session.user.email,
                    },
                },
                userId,
                globalRoles,
                activeOrganizationId,
                organizationRole,
            };

            return handler(req, authCtx, routeCtx);
        } catch (error) {
            if (error instanceof AuthorizationError) {
                return NextResponse.json(
                    { message: error.message },
                    { status: error.statusCode },
                );
            }
            throw error;
        }
    };
}
