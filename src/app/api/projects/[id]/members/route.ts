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

export const GET = withAuth(
  null,
  async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
    const { id } = await routeCtx.params;

    const { project, error } = await assertProjectInOrg(id, activeOrganizationId);
    if (error) return error;

    await requirePerm(PERMISSIONS.PROJECT_MEMBER_MANAGE, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId: id,
    });

    const members = await prisma.projectMember.findMany({
      where: { projectId: project!.id },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ items: members });
  },
);

export const POST = withAuth(
  null,
  async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
    const { id } = await routeCtx.params;

    const { project, error } = await assertProjectInOrg(id, activeOrganizationId);
    if (error) return error;

    await requirePerm(PERMISSIONS.PROJECT_MEMBER_MANAGE, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId: id,
    });

    try {
      const body = (await req.json()) as { userId?: string; role?: string };
      const targetUserId = body.userId?.trim();
      const role = body.role as MemberRole | undefined;

      if (!targetUserId || !role || !ALLOWED_ROLES.includes(role)) {
        return NextResponse.json(
          { message: "userId and a valid role are required." },
          { status: 400 },
        );
      }

      const orgMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: project!.organizationId,
            userId: targetUserId,
          },
        },
      });
      if (!orgMember) {
        return NextResponse.json(
          { message: "The user is not a member of this organization." },
          { status: 400 },
        );
      }

      const member = await prisma.projectMember.create({
        data: {
          projectId: project!.id,
          userId: targetUserId,
          role,
        },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      });

      return NextResponse.json(member, { status: 201 });
    } catch (err) {
      if (err instanceof AuthorizationError) throw err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return NextResponse.json(
          { message: "This user is already a member of the project." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { message: "Could not add the project member." },
        { status: 500 },
      );
    }
  },
);
