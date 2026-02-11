import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TestCaseStatus } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

const STATUS_VALUES: TestCaseStatus[] = ["draft", "ready", "deprecated"];

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

export const PUT = withAuth(null, async (req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;

  try {
    const existing = await prisma.testCase.findUnique({
      where: { id },
      select: {
        suiteId: true,
        suite: {
          select: {
            testPlan: { select: { projectId: true } },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Test case not found." },
        { status: 404 },
      );
    }

    const body = (await req.json()) as {
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

    const targetSuite =
      suiteId === existing.suiteId
        ? existing.suite
        : await prisma.testSuite.findUnique({
          where: { id: suiteId },
          select: {
            testPlan: { select: { projectId: true } },
          },
        });

    if (!targetSuite) {
      return NextResponse.json(
        { message: "Suite not found." },
        { status: 404 },
      );
    }

    // Check permission on current project
    await requirePerm(PERMISSIONS.TEST_CASE_UPDATE, {
      userId,
      globalRoles,
      projectId: existing.suite.testPlan.projectId,
    });

    // If moving to a different suite/project, check permission there too
    if (suiteId !== existing.suiteId) {
      await requirePerm(PERMISSIONS.TEST_CASE_UPDATE, {
        userId,
        globalRoles,
        projectId: targetSuite.testPlan.projectId,
      });
    }

    const testCase = await prisma.testCase.update({
      where: { id },
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
      },
    });

    return NextResponse.json(testCase);
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "Could not update test case." },
      { status: 500 },
    );
  }
});

export const DELETE = withAuth(null, async (_req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;

  try {
    const existing = await prisma.testCase.findUnique({
      where: { id },
      select: {
        suite: {
          select: {
            testPlan: { select: { projectId: true } },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Test case not found." },
        { status: 404 },
      );
    }

    await requirePerm(PERMISSIONS.TEST_CASE_DELETE, {
      userId,
      globalRoles,
      projectId: existing.suite.testPlan.projectId,
    });

    await prisma.testCase.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "Could not delete test case." },
      { status: 500 },
    );
  }
});
