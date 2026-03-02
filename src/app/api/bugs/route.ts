import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, BugStatus, BugSeverity, BugType } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can, require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";
import { parseSortBy, parseSortDir } from "@/lib/sorting";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const STATUS_VALUES: BugStatus[] = ["open", "in_progress", "resolved", "verified", "closed", "reopened"];
const SEVERITY_VALUES: BugSeverity[] = ["critical", "high", "medium", "low"];
const TYPE_VALUES: BugType[] = ["bug", "enhancement", "task"];
const SORTABLE_FIELDS = [
  "bug",
  "status",
  "severity",
  "type",
  "priority",
  "assignedTo",
  "comments",
] as const;
type BugSortBy = (typeof SORTABLE_FIELDS)[number];

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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
  if (value === null || value === undefined) return 3;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(5, Math.max(1, Math.round(parsed)));
}

export const GET = withAuth(PERMISSIONS.BUG_LIST, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
  const { searchParams } = new URL(req.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const query = searchParams.get("query")?.trim();
  const projectId = searchParams.get("projectId")?.trim();
  const status = parseStatus(searchParams.get("status")?.trim() ?? null);
  const severity = parseSeverity(searchParams.get("severity")?.trim() ?? null);
  const type = parseType(searchParams.get("type")?.trim() ?? null);
  const assignedToId = searchParams.get("assignedToId")?.trim();
  const requestedSortBy = searchParams.get("sortBy");
  const sortBy =
    requestedSortBy && SORTABLE_FIELDS.includes(requestedSortBy as BugSortBy)
      ? parseSortBy<BugSortBy>(requestedSortBy, SORTABLE_FIELDS, "bug")
      : null;
  const sortDir = parseSortDir(searchParams.get("sortDir"), "asc");

  if (projectId) {
    const allowed = await can(PERMISSIONS.BUG_LIST, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId,
    });
    if (!allowed) {
      return NextResponse.json(
        { message: "You do not have access to this project." },
        { status: 403 },
      );
    }
  }

  const filters: Prisma.BugWhereInput[] = [];

  // Scope to active organization
  if (activeOrganizationId) {
    filters.push({ project: { organizationId: activeOrganizationId } });
  }

  if (projectId) {
    filters.push({ projectId });
  }
  if (status) {
    filters.push({ status });
  }
  if (severity) {
    filters.push({ severity });
  }
  if (type) {
    filters.push({ type });
  }
  if (assignedToId) {
    filters.push({ assignedToId });
  }
  if (query) {
    filters.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { reproductionSteps: { contains: query, mode: "insensitive" } },
        { environment: { contains: query, mode: "insensitive" } },
        { project: { name: { contains: query, mode: "insensitive" } } },
        { project: { key: { contains: query, mode: "insensitive" } } },
      ],
    });
  }

  // Org owner/admin can see all bugs in their org; others need explicit membership
  if (!organizationRole || (organizationRole !== "owner" && organizationRole !== "admin")) {
    filters.push({
      project: {
        members: {
          some: { userId },
        },
      },
    });
  }

  const where: Prisma.BugWhereInput = filters.length
    ? { AND: filters }
    : {};

  let orderBy: Prisma.BugOrderByWithRelationInput[] = [
    { updatedAt: "desc" },
    { id: "asc" },
  ];

  if (sortBy) {
    switch (sortBy) {
      case "bug":
        orderBy = [{ title: sortDir }, { updatedAt: "desc" }, { id: "asc" }];
        break;
      case "status":
      case "severity":
      case "type":
      case "priority":
        orderBy = [{ [sortBy]: sortDir }, { title: "asc" }, { id: "asc" }];
        break;
      case "assignedTo":
        orderBy = [
          { assignedTo: { fullName: sortDir } },
          { title: "asc" },
          { id: "asc" },
        ];
        break;
      case "comments":
        orderBy = [
          { comments: { _count: sortDir } },
          { updatedAt: "desc" },
          { id: "asc" },
        ];
        break;
    }
  }

  const [items, total] = await prisma.$transaction([
    prisma.bug.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            key: true,
            name: true,
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
        _count: {
          select: { comments: true },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.bug.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
});

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
  try {
    const body = (await req.json()) as {
      projectId?: string;
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

    const projectId = body.projectId?.trim();
    const title = body.title?.trim();

    if (!projectId || !title) {
      return NextResponse.json(
        { message: "projectId and title are required." },
        { status: 400 },
      );
    }

    await requirePerm(PERMISSIONS.BUG_CREATE, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId,
    });

    const severity = parseSeverity(body.severity ?? null) ?? "medium";
    const priority = parsePriority(body.priority);
    const status = parseStatus(body.status ?? null) ?? "open";
    const type = parseType(body.type ?? null) ?? "bug";
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter((t) => t.length > 0)
      : [];

    const bug = await prisma.bug.create({
      data: {
        projectId,
        title,
        description: body.description?.trim() || null,
        severity,
        priority,
        status,
        type,
        assignedToId: body.assignedToId?.trim() || null,
        reporterId: userId,
        testRunItemId: body.testRunItemId?.trim() || null,
        testCaseId: body.testCaseId?.trim() || null,
        reproductionSteps: body.reproductionSteps?.trim() || null,
        expectedResult: body.expectedResult?.trim() || null,
        actualResult: body.actualResult?.trim() || null,
        environment: body.environment?.trim() || null,
        tags,
      },
    });

    return NextResponse.json(bug, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "Could not create bug." },
      { status: 500 },
    );
  }
});
