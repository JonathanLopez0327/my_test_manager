import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";
import { getProjectRelatedCounts } from "@/lib/api/related-counts";

export const GET = withAuth(null, async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;

  if (activeOrganizationId) {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!project) {
      return NextResponse.json(
        { message: "Project not found." },
        { status: 404 },
      );
    }
    if (project.organizationId !== activeOrganizationId) {
      return NextResponse.json(
        { message: "The project does not belong to the active organization." },
        { status: 403 },
      );
    }
  }

  await requirePerm(PERMISSIONS.PROJECT_LIST, {
    userId,
    globalRoles,
    organizationId: activeOrganizationId,
    organizationRole,
    projectId: id,
  });

  try {
    const counts = await getProjectRelatedCounts(id);
    return NextResponse.json({ counts });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "Could not retrieve project stats." },
      { status: 500 },
    );
  }
});
