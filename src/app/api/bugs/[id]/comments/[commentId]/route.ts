import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

export const DELETE = withAuth(null, async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id, commentId } = await routeCtx.params;

  try {
    // Find comment first
    const comment = await prisma.bugComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorId: true,
        bugId: true,
        bug: {
          select: {
            id: true,
            projectId: true,
            project: { select: { organizationId: true } },
          },
        },
      },
    });

    if (!comment || comment.bugId !== id) {
      return NextResponse.json(
        { message: "Comment not found." },
        { status: 404 },
      );
    }

    // Verify bug belongs to active organization
    if (activeOrganizationId && comment.bug.project.organizationId !== activeOrganizationId) {
      return NextResponse.json(
        { message: "Comment not found." },
        { status: 404 },
      );
    }

    // Check: user has BUG_COMMENT_DELETE permission OR is the comment author
    const isAuthor = comment.authorId === userId;

    if (!isAuthor) {
      const hasPermission = await can(PERMISSIONS.BUG_COMMENT_DELETE, {
        userId,
        globalRoles,
        organizationId: activeOrganizationId,
        organizationRole,
        projectId: comment.bug.projectId,
      });

      if (!hasPermission) {
        return NextResponse.json(
          { message: "You do not have permission to delete this comment." },
          { status: 403 },
        );
      }
    }

    await prisma.bugComment.delete({ where: { id: commentId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "Could not delete comment." },
      { status: 500 },
    );
  }
});
