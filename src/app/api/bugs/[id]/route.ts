import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BugStatus, BugSeverity, BugType } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

const STATUS_VALUES: BugStatus[] = ["open", "in_progress", "resolved", "verified", "closed", "reopened"];
const SEVERITY_VALUES: BugSeverity[] = ["critical", "high", "medium", "low"];
const TYPE_VALUES: BugType[] = ["bug", "enhancement", "task"];

function parseStatus(value?: string | null) {
  if (!value) return null;
  return STATUS_VALUES.includes(value as BugStatus)
    ? (value as BugStatus)
    : null;
}

function parseSeverity(value?: string | null) {
  if (!value) return null;
  return SEVERITY_VALUES.includes(value as BugSeverity)
    ? (value as BugSeverity)
    : null;
}

function parseType(value?: string | null) {
  if (!value) return null;
  return TYPE_VALUES.includes(value as BugType)
    ? (value as BugType)
    : null;
}

function parsePriority(value?: number | null) {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(5, Math.max(1, Math.round(parsed)));
}

export const GET = withAuth(PERMISSIONS.BUG_LIST, async (_req, { activeOrganizationId }, routeCtx) => {
  const { id } = await routeCtx.params;

  const bug = await prisma.bug.findUnique({
    where: { id },
    include: {
      project: {
        select: {
          id: true,
          key: true,
          name: true,
          organizationId: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      reporter: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      testCase: {
        select: {
          id: true,
          title: true,
        },
      },
      testRunItem: {
        select: {
          id: true,
          status: true,
        },
      },
      comments: {
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
        take: 50,
      },
      _count: {
        select: { comments: true },
      },
    },
  });

  if (!bug) {
    return NextResponse.json(
      { message: "Bug not found." },
      { status: 404 },
    );
  }

  // Verify bug belongs to active organization
  if (activeOrganizationId && bug.project.organizationId !== activeOrganizationId) {
    return NextResponse.json(
      { message: "Bug not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(bug);
});

export const PUT = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;

  try {
    const existing = await prisma.bug.findUnique({
      where: { id },
      select: {
        projectId: true,
        project: {
          select: { organizationId: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Bug not found." },
        { status: 404 },
      );
    }

    // Verify bug belongs to active organization
    if (activeOrganizationId && existing.project.organizationId !== activeOrganizationId) {
      return NextResponse.json(
        { message: "Bug not found." },
        { status: 404 },
      );
    }

    await requirePerm(PERMISSIONS.BUG_UPDATE, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId: existing.projectId,
    });

    const body = (await req.json()) as {
      title?: string;
      description?: string | null;
      severity?: string;
      priority?: number | null;
      status?: string;
      type?: string;
      assignedToId?: string | null;
      testRunItemId?: string | null;
      testCaseId?: string | null;
      reproductionSteps?: string | null;
      expectedResult?: string | null;
      actualResult?: string | null;
      environment?: string | null;
      tags?: unknown;
    };

    const data: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = body.title?.trim();
      if (!title) {
        return NextResponse.json(
          { message: "Title cannot be empty." },
          { status: 400 },
        );
      }
      data.title = title;
    }
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.severity !== undefined) {
      const severity = parseSeverity(body.severity);
      if (severity) data.severity = severity;
    }
    if (body.priority !== undefined) {
      const priority = parsePriority(body.priority);
      if (priority !== undefined) data.priority = priority;
    }
    if (body.status !== undefined) {
      const status = parseStatus(body.status);
      if (status) data.status = status;
    }
    if (body.type !== undefined) {
      const type = parseType(body.type);
      if (type) data.type = type;
    }
    if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId?.trim() || null;
    if (body.testRunItemId !== undefined) data.testRunItemId = body.testRunItemId?.trim() || null;
    if (body.testCaseId !== undefined) data.testCaseId = body.testCaseId?.trim() || null;
    if (body.reproductionSteps !== undefined) data.reproductionSteps = body.reproductionSteps?.trim() || null;
    if (body.expectedResult !== undefined) data.expectedResult = body.expectedResult?.trim() || null;
    if (body.actualResult !== undefined) data.actualResult = body.actualResult?.trim() || null;
    if (body.environment !== undefined) data.environment = body.environment?.trim() || null;
    if (body.tags !== undefined) {
      data.tags = Array.isArray(body.tags)
        ? body.tags.map((t) => String(t).trim()).filter((t) => t.length > 0)
        : [];
    }

    const bug = await prisma.bug.update({
      where: { id },
      data,
    });

    return NextResponse.json(bug);
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "Could not update bug." },
      { status: 500 },
    );
  }
});

export const DELETE = withAuth(null, async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;

  try {
    const existing = await prisma.bug.findUnique({
      where: { id },
      select: {
        projectId: true,
        project: {
          select: { organizationId: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Bug not found." },
        { status: 404 },
      );
    }

    // Verify bug belongs to active organization
    if (activeOrganizationId && existing.project.organizationId !== activeOrganizationId) {
      return NextResponse.json(
        { message: "Bug not found." },
        { status: 404 },
      );
    }

    await requirePerm(PERMISSIONS.BUG_DELETE, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId: existing.projectId,
    });

    await prisma.bug.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "Could not delete bug." },
      { status: 500 },
    );
  }
});
