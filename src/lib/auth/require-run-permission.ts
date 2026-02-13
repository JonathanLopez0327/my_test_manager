import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { GlobalRole, OrgRole } from "@/generated/prisma/client";
import type { Permission } from "./permissions.constants";
import { can } from "./policy-engine";

/**
 * Resolves the projectId for a test run and checks the given permission.
 * Returns the run if allowed, or an error response if denied.
 */
export async function requireRunPermission(
    userId: string,
    globalRoles: GlobalRole[],
    runId: string,
    permission: Permission,
    organizationId?: string,
    organizationRole?: OrgRole,
): Promise<
    | { run: { id: string; projectId: string }; error?: never }
    | { run?: never; error: NextResponse }
> {
    const run = await prisma.testRun.findUnique({
        where: { id: runId },
        select: { id: true, projectId: true },
    });

    if (!run) {
        return {
            error: NextResponse.json(
                { message: "Run no encontrado." },
                { status: 404 },
            ),
        };
    }

    const allowed = await can(permission, {
        userId,
        globalRoles,
        organizationId,
        organizationRole,
        projectId: run.projectId,
    });

    if (!allowed) {
        return {
            error: NextResponse.json(
                { message: "No tienes permisos en este proyecto." },
                { status: 403 },
            ),
        };
    }

    return { run };
}
