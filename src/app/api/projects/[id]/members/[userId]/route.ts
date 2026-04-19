import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, type MemberRole } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

const ALLOWED_ROLES: MemberRole[] = ["viewer", "editor", "admin"];

async function assertProjectInOrg(projectId: string, activeOrganizationId?: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, organizationId: true },
  });
  if (!project) {
    return { error: NextResponse.json({ message: "Project not found." }, { status: 404 }) };
  }
  if (activeOrganizationId && project.organizationId !== activeOrganizationId) {
    return {
      error: NextResponse.json(
        { message: "The project does not belong to the active organization." },
        { status: 403 },
      ),
    };
  }
  return { project };
}

export const PATCH = withAuth(
  null,
  async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
    const { id, userId: targetUserId } = await routeCtx.params;

    const { project, error } = await assertProjectInOrg(id, activeOrganizationId);
    if (error) return error;

    await requirePerm(PERMISSIONS.PROJECT_MEMBER_MANAGE, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId: id,
    });

    if (targetUserId === userId) {
      return NextResponse.json(
        { message: "You cannot change your own project role." },
        { status: 400 },
      );
    }

    try {
      const body = (await req.json()) as { role?: string };
      const role = body.role as MemberRole | undefined;
      if (!role || !ALLOWED_ROLES.includes(role)) {
        return NextResponse.json(
          { message: "A valid role is required." },
          { status: 400 },
        );
      }

      const updated = await prisma.projectMember.update({
        where: {
          projectId_userId: {
            projectId: project!.id,
            userId: targetUserId,
          },
        },
        data: { role },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      });

      return NextResponse.json(updated);
    } catch (err) {
      if (err instanceof AuthorizationError) throw err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return NextResponse.json(
          { message: "The user is not a member of this project." },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { message: "Could not update the project member." },
        { status: 500 },
      );
    }
  },
);

export const DELETE = withAuth(
  null,
  async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
    const { id, userId: targetUserId } = await routeCtx.params;

    const { project, error } = await assertProjectInOrg(id, activeOrganizationId);
    if (error) return error;

    await requirePerm(PERMISSIONS.PROJECT_MEMBER_MANAGE, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId: id,
    });

    if (targetUserId === userId) {
      return NextResponse.json(
        { message: "You cannot remove yourself from the project." },
        { status: 400 },
      );
    }

    try {
      await prisma.projectMember.delete({
        where: {
          projectId_userId: {
            projectId: project!.id,
            userId: targetUserId,
          },
        },
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      if (err instanceof AuthorizationError) throw err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return NextResponse.json(
          { message: "The user is not a member of this project." },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { message: "Could not remove the project member." },
        { status: 500 },
      );
    }
  },
);
