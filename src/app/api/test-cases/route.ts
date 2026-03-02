import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, TestCaseStatus } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can, require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";
import { parseStyle, normalizeSteps } from "@/lib/test-cases/normalize-steps";
import { parseSortBy, parseSortDir } from "@/lib/sorting";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const STATUS_VALUES: TestCaseStatus[] = ["draft", "ready", "deprecated"];
const SORTABLE_FIELDS = [
  "case",
  "suite",
  "status",
  "tags",
  "priority",
  "automation",
] as const;
type TestCaseSortBy = (typeof SORTABLE_FIELDS)[number];

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStatus(value?: string | null) {
  if (!value) return null;
  return STATUS_VALUES.includes(value as TestCaseStatus)
    ? (value as TestCaseStatus)
    : null;
}

function parsePriority(value?: number | null) {
  if (value === null || value === undefined) return 3;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(5, Math.max(1, Math.round(parsed)));
}

export const GET = withAuth(PERMISSIONS.TEST_CASE_LIST, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
  const { searchParams } = new URL(req.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const query = searchParams.get("query")?.trim();
  const suiteId = searchParams.get("suiteId")?.trim();
  const tag = searchParams.get("tag")?.trim();
  const testPlanId = searchParams.get("testPlanId")?.trim();
  const projectId = searchParams.get("projectId")?.trim();
  const status = parseStatus(searchParams.get("status")?.trim() ?? null);
  const requestedSortBy = searchParams.get("sortBy");
  const sortBy =
    requestedSortBy && SORTABLE_FIELDS.includes(requestedSortBy as TestCaseSortBy)
      ? parseSortBy<TestCaseSortBy>(requestedSortBy, SORTABLE_FIELDS, "case")
      : null;
  const sortDir = parseSortDir(searchParams.get("sortDir"), "asc");

  if (projectId) {
    const allowed = await can(PERMISSIONS.TEST_CASE_LIST, {
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

  const filters: Prisma.TestCaseWhereInput[] = [];

  // Scope to active organization
  if (activeOrganizationId) {
    filters.push({ suite: { testPlan: { project: { organizationId: activeOrganizationId } } } });
  }

  if (suiteId) {
    filters.push({ suiteId });
  }
  if (tag) {
    filters.push({ tags: { has: tag } });
  }
  if (testPlanId) {
    filters.push({ suite: { testPlanId } });
  }
  if (projectId) {
    filters.push({ suite: { testPlan: { projectId } } });
  }
  if (status) {
    filters.push({ status });
  }
  if (query) {
    filters.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { preconditions: { contains: query, mode: "insensitive" } },
        { externalKey: { contains: query, mode: "insensitive" } },
        { suite: { name: { contains: query, mode: "insensitive" } } },
        { suite: { testPlan: { name: { contains: query, mode: "insensitive" } } } },
        {
          suite: {
            testPlan: {
              project: { name: { contains: query, mode: "insensitive" } },
            },
          },
        },
        {
          suite: {
            testPlan: {
              project: { key: { contains: query, mode: "insensitive" } },
            },
          },
        },
      ],
    });
  }
  // Org owner/admin can see all cases in their org; others need explicit membership
  if (!organizationRole || (organizationRole !== "owner" && organizationRole !== "admin")) {
    filters.push({
      suite: {
        testPlan: {
          project: {
            members: {
              some: { userId },
            },
          },
        },
      },
    });
  }

  const where: Prisma.TestCaseWhereInput = filters.length
    ? { AND: filters }
    : {};

  let orderBy: Prisma.TestCaseOrderByWithRelationInput[] = [
    { updatedAt: "desc" },
    { id: "asc" },
  ];

  if (sortBy) {
    switch (sortBy) {
      case "case":
        orderBy = [{ title: sortDir }, { updatedAt: "desc" }, { id: "asc" }];
        break;
      case "suite":
        orderBy = [{ suite: { name: sortDir } }, { title: "asc" }, { id: "asc" }];
        break;
      case "status":
      case "priority":
        orderBy = [{ [sortBy]: sortDir }, { title: "asc" }, { id: "asc" }];
        break;
      case "tags":
        // Proxy sort: stable ordering by title when the column is derived.
        orderBy = [{ title: sortDir }, { updatedAt: "desc" }, { id: "asc" }];
        break;
      case "automation":
        orderBy = [
          { isAutomated: sortDir },
          { automationType: sortDir },
          { title: "asc" },
          { id: "asc" },
        ];
        break;
    }
  }

  const [items, total] = await prisma.$transaction([
    prisma.testCase.findMany({
      where,
      include: {
        suite: {
          select: {
            id: true,
            name: true,
            testPlan: {
              select: {
                id: true,
                name: true,
                project: {
                  select: {
                    id: true,
                    key: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.testCase.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
});

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }) => {
  try {
    const body = (await req.json()) as {
      suiteId?: string;
      title?: string;
      style?: string;
      description?: string | null;
      preconditions?: string | null;
      steps?: unknown;
      tags?: unknown;
      status?: TestCaseStatus;
      priority?: number | null;
      isAutomated?: boolean;
      automationType?: string | null;
      automationRef?: string | null;
    };

    const suiteId = body.suiteId?.trim();
    const title = body.title?.trim();
    const style = parseStyle(body.style);
    const status = parseStatus(body.status ?? null) ?? "draft";
    const priority = parsePriority(body.priority);
    const steps = normalizeSteps(body.steps, style);
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter((t) => t.length > 0)
      : [];
    const isAutomated = Boolean(body.isAutomated);
    const automationType = body.automationType?.trim() || null;
    const automationRef = body.automationRef?.trim() || null;

    if (!suiteId || !title) {
      return NextResponse.json(
        { message: "Suite and title are required." },
        { status: 400 },
      );
    }

    const suite = await prisma.testSuite.findUnique({
      where: { id: suiteId },
      select: {
        id: true,
        testPlan: { select: { projectId: true } },
      },
    });

    if (!suite) {
      return NextResponse.json(
        { message: "Suite not found." },
        { status: 404 },
      );
    }

    await requirePerm(PERMISSIONS.TEST_CASE_CREATE, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId: suite.testPlan.projectId,
    });

    const testCase = await prisma.testCase.create({
      data: {
        suiteId,
        title,
        style,
        description: body.description?.trim() || null,
        preconditions: body.preconditions?.trim() || null,
        steps,
        tags,
        status,
        priority,
        isAutomated,
        automationType: isAutomated ? automationType : null,
        automationRef: isAutomated ? automationRef : null,
        createdById: userId,
      },
    });

    return NextResponse.json(testCase, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "Could not create test case." },
      { status: 500 },
    );
  }
});
