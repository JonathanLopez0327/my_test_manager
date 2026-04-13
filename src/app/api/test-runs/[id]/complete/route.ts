import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { COMPLETED_RUN_LOCK_MESSAGE } from "@/lib/auth/ensure-run-mutable";

export const POST = withAuth(
  null,
  async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
    const { id } = await routeCtx.params;
    const access = await requireRunPermission(
      userId,
      globalRoles,
      id,
      PERMISSIONS.TEST_RUN_UPDATE,
      activeOrganizationId,
      organizationRole,
    );
    if (access.error) return access.error;

    const now = new Date();
    const result = await prisma.testRun.updateMany({
      where: {
        id,
        status: { not: "completed" },
      },
      data: {
        status: "completed",
        finishedAt: now,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { message: COMPLETED_RUN_LOCK_MESSAGE },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, status: "completed" });
  },
);

