import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;

  try {
    const original = await prisma.testCase.findUnique({
      where: { id },
      select: {
        title: true,
        description: true,
        preconditions: true,
        style: true,
        steps: true,
        tags: true,
        priority: true,
        isAutomated: true,
        automationType: true,
        suiteId: true,
        suite: {
          select: {
            testPlan: { select: { projectId: true } },
          },
        },
      },
    });

    if (!original) {
      return NextResponse.json(
        { message: "Test case not found." },
        { status: 404 },
      );
    }

    // Permission check on source project
    await requirePerm(PERMISSIONS.TEST_CASE_CREATE, {
      userId,
      globalRoles,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId: original.suite.testPlan.projectId,
    });

    // Optional: duplicate into a different suite
    const body = (await req.json().catch(() => ({}))) as {
      suiteId?: string;
    };

    let targetSuiteId = original.suiteId;

    if (body.suiteId && body.suiteId !== original.suiteId) {
      const targetSuite = await prisma.testSuite.findUnique({
        where: { id: body.suiteId },
        select: {
          id: true,
          testPlan: { select: { projectId: true } },
        },
      });

      if (!targetSuite) {
        return NextResponse.json(
          { message: "Target suite not found." },
          { status: 404 },
        );
      }

      // Permission check on target project
      await requirePerm(PERMISSIONS.TEST_CASE_CREATE, {
        userId,
        globalRoles,
        organizationId: activeOrganizationId,
        organizationRole,
        projectId: targetSuite.testPlan.projectId,
      });

      targetSuiteId = targetSuite.id;
    }

    const duplicate = await prisma.testCase.create({
      data: {
        suiteId: targetSuiteId,
        title: `(Copy) ${original.title}`,
        description: original.description,
        preconditions: original.preconditions,
        style: original.style,
        steps: original.steps ?? [],
        tags: original.tags ?? [],
        priority: original.priority,
        isAutomated: original.isAutomated,
        automationType: original.isAutomated ? original.automationType : null,
        automationRef: null,
        externalKey: null,
        status: "draft",
        createdById: userId,
      },
    });

    return NextResponse.json(duplicate, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "Could not duplicate test case." },
      { status: 500 },
    );
  }
});
