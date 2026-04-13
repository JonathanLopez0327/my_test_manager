import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { getProjectRelatedCounts, hasAnyRelated, formatRelatedMessage } from "@/lib/api/related-counts";
import { require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

export const GET = withAuth(PERMISSIONS.PROJECT_LIST, async (_req, { activeOrganizationId }, routeCtx) => {
  const { id } = await routeCtx.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, fullName: true, email: true } } },
        },
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!project) {
      return NextResponse.json(
        { message: "Project not found." },
        { status: 404 },
      );
    }

    // Ensure project belongs to the active organization
    if (activeOrganizationId && project.organizationId !== activeOrganizationId) {
      return NextResponse.json(
        { message: "The project does not belong to the active organization." },
        { status: 403 },
      );
    }

    return NextResponse.json(project);
  } catch {
    return NextResponse.json(
      { message: "Could not retrieve the project." },
      { status: 500 },
    );
  }
});

export const PUT = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;

  // Verify project belongs to active org
  if (activeOrganizationId) {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (project && project.organizationId !== activeOrganizationId) {
      return NextResponse.json(
        { message: "The project does not belong to the active organization." },
        { status: 403 },
      );
    }
  }

  await requirePerm(PERMISSIONS.PROJECT_UPDATE, {
    userId,
    globalRoles,
    organizationId: activeOrganizationId,
    organizationRole,
    projectId: id,
  });

  try {
    const body = (await req.json()) as {
      key?: string;
      name?: string;
      description?: string | null;
      context?: string | null;
      isActive?: boolean;
    };

    const key = body.key?.trim().toUpperCase();
    const name = body.name?.trim();

    if (!key || !name) {
      return NextResponse.json(
        { message: "Key and name are required." },
        { status: 400 },
      );
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        key,
        name,
        description: body.description?.trim() || null,
        context: body.context?.trim() || null,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Ya existe un project con ese key." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "Could not update the project." },
      { status: 500 },
    );
  }
});

export const DELETE = withAuth(null, async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;

  // Verify project belongs to active org
  if (activeOrganizationId) {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (project && project.organizationId !== activeOrganizationId) {
      return NextResponse.json(
        { message: "The project does not belong to the active organization." },
        { status: 403 },
      );
    }
  }

  await requirePerm(PERMISSIONS.PROJECT_DELETE, {
    userId,
    globalRoles,
    organizationId: activeOrganizationId,
    organizationRole,
    projectId: id,
  });

  try {
    const counts = await getProjectRelatedCounts(id);
    if (hasAnyRelated(counts)) {
      return NextResponse.json(
        {
          message: formatRelatedMessage("project", counts),
          code: "HAS_RELATED_ELEMENTS",
          counts,
        },
        { status: 409 },
      );
    }

    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "Could not delete the project." },
      { status: 500 },
    );
  }
});


