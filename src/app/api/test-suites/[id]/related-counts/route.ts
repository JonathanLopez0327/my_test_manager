import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";
import { getTestSuiteRelatedCounts, hasAnyRelated } from "@/lib/api/related-counts";

export const GET = withAuth(null, async (_req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;

  try {
    const existing = await prisma.testSuite.findUnique({
      where: { id },
      select: {
        testPlan: { select: { projectId: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Test suite not found." },
        { status: 404 },
      );
    }

    await requirePerm(PERMISSIONS.TEST_SUITE_DELETE, {
      userId,
      globalRoles,
      projectId: existing.testPlan.projectId,
    });

    const counts = await getTestSuiteRelatedCounts(id);
    return NextResponse.json({ counts, hasRelated: hasAnyRelated(counts) });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "Could not retrieve related counts." },
      { status: 500 },
    );
  }
});
