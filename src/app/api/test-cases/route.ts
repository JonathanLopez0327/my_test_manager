import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { Prisma, TestCaseStatus } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import {
  getGlobalRoles,
  getProjectRole,
  hasProjectPermission,
  isReadOnlyGlobal,
  isSuperAdmin,
} from "@/lib/permissions";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const STATUS_VALUES: TestCaseStatus[] = ["draft", "ready", "deprecated"];

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

function normalizeSteps(value?: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const step = (item as any).step;
          const expectedResult = (item as any).expectedResult;
          if (typeof step === "string" || typeof expectedResult === "string") {
            return {
              step: String(step ?? "").trim(),
              expectedResult: String(expectedResult ?? "").trim(),
            };
          }
        }
        return String(item).trim();
      })
      .filter((item) => {
        if (typeof item === "string") return item.length > 0;
        return item.step || item.expectedResult;
      });
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }


  const globalRoles = await getGlobalRoles(session.user.id);
  const isGlobalAdmin = isSuperAdmin(globalRoles);
  const isGlobalReadOnly = isReadOnlyGlobal(globalRoles);

  const { searchParams } = new URL(request.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const query = searchParams.get("query")?.trim();
  const suiteId = searchParams.get("suiteId")?.trim();
  const testPlanId = searchParams.get("testPlanId")?.trim();
  const projectId = searchParams.get("projectId")?.trim();
  const status = parseStatus(searchParams.get("status")?.trim() ?? null);

  if (projectId && !isGlobalAdmin && !isGlobalReadOnly) {
    const role = await getProjectRole(session.user.id, projectId);
    if (!role) {
      return NextResponse.json(
        { message: "You do not have access to this project." },
        { status: 403 },
      );
    }
  }

  const filters: Prisma.TestCaseWhereInput[] = [];
  if (suiteId) {
    filters.push({ suiteId });
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
  if (!isGlobalAdmin && !isGlobalReadOnly) {
    filters.push({
      suite: {
        testPlan: {
          project: {
            members: {
              some: {
                userId: session.user.id,
              },
            },
          },
        },
      },
    });
  }

  const where: Prisma.TestCaseWhereInput = filters.length
    ? { AND: filters }
    : {};

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
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.testCase.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }


  try {
    const body = (await request.json()) as {
      suiteId?: string;
      title?: string;
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
    const status = parseStatus(body.status ?? null) ?? "draft";
    const priority = parsePriority(body.priority);
    const steps = normalizeSteps(body.steps);
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
        testPlan: {
          select: {
            projectId: true,
          },
        },
      },
    });

    if (!suite) {
      return NextResponse.json(
        { message: "Suite not found." },
        { status: 404 },
      );
    }

    const globalRoles = await getGlobalRoles(session.user.id);
    if (!isSuperAdmin(globalRoles)) {
      if (isReadOnlyGlobal(globalRoles)) {
        return NextResponse.json(
          { message: "Read only." },
          { status: 403 },
        );
      }
      const role = await getProjectRole(session.user.id, suite.testPlan.projectId);
      if (!hasProjectPermission(role, "editor")) {
        return NextResponse.json(
          { message: "You do not have permission to create test cases." },
          { status: 403 },
        );
      }
    }

    const testCase = await prisma.testCase.create({
      data: {
        suiteId,
        title,
        description: body.description?.trim() || null,
        preconditions: body.preconditions?.trim() || null,
        steps,
        tags,
        status,
        priority,
        isAutomated,
        automationType: isAutomated ? automationType : null,
        automationRef: isAutomated ? automationRef : null,
        createdById: session.user.id,
      },
    });

    return NextResponse.json(testCase, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: "Could not create test case." },
      { status: 500 },
    );
  }
}
