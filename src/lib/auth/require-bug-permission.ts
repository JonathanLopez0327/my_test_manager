import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { GlobalRole, OrgRole } from "@/generated/prisma/client";
import type { Permission } from "./permissions.constants";
import { can } from "./policy-engine";

/**
 * Resolves project scope for a bug and checks the requested permission.
 */
export async function requireBugPermission(
  userId: string,
  globalRoles: GlobalRole[],
  bugId: string,
  permission: Permission,
  organizationId?: string,
  organizationRole?: OrgRole,
): Promise<
  | { bug: { id: string; projectId: string }; error?: never }
  | { bug?: never; error: NextResponse }
> {
  const bug = await prisma.bug.findUnique({
    where: { id: bugId },
    select: {
      id: true,
      projectId: true,
      project: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!bug) {
    return {
      error: NextResponse.json(
        { message: "Bug not found." },
        { status: 404 },
      ),
    };
  }

  if (organizationId && bug.project.organizationId !== organizationId) {
    return {
      error: NextResponse.json(
        { message: "Bug not found." },
        { status: 404 },
      ),
    };
  }

  const allowed = await can(permission, {
    userId,
    globalRoles,
    organizationId,
    organizationRole,
    projectId: bug.projectId,
  });

  if (!allowed) {
    return {
      error: NextResponse.json(
        { message: "You do not have permission in this project." },
        { status: 403 },
      ),
    };
  }

  return {
    bug: { id: bug.id, projectId: bug.projectId },
  };
}
