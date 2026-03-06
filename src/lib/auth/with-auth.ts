import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { GlobalRole, OrgRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashApiToken, parseBearerToken } from "./api-token";
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
    authType: "session" | "api_token";
    apiTokenId?: string;
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
            const authCtx = await resolveAuthContext(req);
            if (!authCtx) {
                return NextResponse.json(
                    { message: "No autorizado." },
                    { status: 401 },
                );
            }

            // If a specific permission is required, check it
            if (permission) {
                await requirePermission(permission, {
                    userId: authCtx.userId,
                    globalRoles: authCtx.globalRoles,
                    organizationId: authCtx.activeOrganizationId,
                    organizationRole: authCtx.organizationRole,
                });
            }

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

async function resolveAuthContext(req: NextRequest): Promise<AuthContext | null> {
    const bearerToken = parseBearerToken(req.headers.get("authorization"));
    if (bearerToken) {
        const tokenCtx = await resolveApiTokenContext(bearerToken);
        if (!tokenCtx) return null;
        await prisma.apiToken.update({
            where: { id: tokenCtx.apiTokenId },
            data: { lastUsedAt: new Date() },
        });
        return tokenCtx;
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;

    const userId = session.user.id;
    const globalRoles = (session.user.globalRoles ?? []) as GlobalRole[];
    const activeOrganizationId = session.user.activeOrganizationId as string | undefined;
    const organizationRole = session.user.organizationRole as OrgRole | undefined;

    return {
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
        authType: "session",
    };
}

async function resolveApiTokenContext(token: string): Promise<AuthContext | null> {
    const tokenHash = hashApiToken(token);
    const now = new Date();

    const apiToken = await prisma.apiToken.findUnique({
        where: { tokenHash },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    isActive: true,
                    globalRoles: {
                        select: { role: true },
                    },
                    organizationMemberships: {
                        orderBy: { createdAt: "asc" },
                        select: {
                            organizationId: true,
                            role: true,
                        },
                    },
                },
            },
        },
    });

    if (
        !apiToken ||
        !apiToken.isActive ||
        apiToken.revokedAt ||
        (apiToken.expiresAt && apiToken.expiresAt <= now) ||
        !apiToken.user.isActive
    ) {
        return null;
    }

    const globalRoles = apiToken.user.globalRoles.map((item) => item.role) as GlobalRole[];
    const isSuperAdmin = globalRoles.includes("super_admin");
    let activeOrganizationId: string | undefined;
    let organizationRole: OrgRole | undefined;

    if (apiToken.organizationId) {
        const membership = apiToken.user.organizationMemberships.find(
            (item) => item.organizationId === apiToken.organizationId,
        );
        if (membership) {
            activeOrganizationId = membership.organizationId;
            organizationRole = membership.role;
        } else if (isSuperAdmin) {
            activeOrganizationId = apiToken.organizationId;
        } else {
            return null;
        }
    } else if (!isSuperAdmin) {
        const defaultMembership = apiToken.user.organizationMemberships[0];
        if (defaultMembership) {
            activeOrganizationId = defaultMembership.organizationId;
            organizationRole = defaultMembership.role;
        }
    }

    return {
        session: {
            user: {
                id: apiToken.user.id,
                globalRoles,
                activeOrganizationId,
                organizationRole,
                name: apiToken.user.fullName,
                email: apiToken.user.email,
            },
        },
        userId: apiToken.user.id,
        globalRoles,
        activeOrganizationId,
        organizationRole,
        authType: "api_token",
        apiTokenId: apiToken.id,
    };
}
