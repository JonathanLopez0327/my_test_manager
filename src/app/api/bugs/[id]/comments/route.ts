import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const GET = withAuth(PERMISSIONS.BUG_LIST, async (req, { activeOrganizationId }, routeCtx) => {
  const { id } = await routeCtx.params;
  const { searchParams } = new URL(req.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  // Verify bug exists and belongs to active org
  const bug = await prisma.bug.findUnique({
    where: { id },
    select: {
      id: true,
      project: { select: { organizationId: true } },
    },
  });

  if (!bug) {
    return NextResponse.json(
      { message: "Bug not found." },
      { status: 404 },
    );
  }

  if (activeOrganizationId && bug.project.organizationId !== activeOrganizationId) {
    return NextResponse.json(
      { message: "Bug not found." },
      { status: 404 },
    );
  }

  const where: Prisma.BugCommentWhereInput = { bugId: id };

  const [items, total] = await prisma.$transaction([
    prisma.bugComment.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.bugComment.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
});

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;

  try {
    // Find the bug first to get projectId for permission check
    const bug = await prisma.bug.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        project: { select: { organizationId: true } },
      },
    });

    if (!bug) {
      return NextResponse.json(
        { message: "Bug not found." },
        { status: 404 },
      );
    }

    if (activeOrganizationId && bug.project.organizationId !== activeOrganizationId) {
      return NextResponse.json(
        { message: "Bug not found." },
        { status: 404 },
      );
    }

    await requirePerm(PERMISSIONS.BUG_COMMENT_CREATE, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId: bug.projectId,
    });

    const body = (await req.json()) as {
      content?: string;
    };

    const content = body.content?.trim();

    if (!content) {
      return NextResponse.json(
        { message: "content is required." },
        { status: 400 },
      );
    }

    const comment = await prisma.bugComment.create({
      data: {
        bugId: id,
        authorId: userId,
        content,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "Could not create comment." },
      { status: 500 },
    );
  }
});
