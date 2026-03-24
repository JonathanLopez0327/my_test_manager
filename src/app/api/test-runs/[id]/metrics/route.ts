import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { upsertRunMetrics } from "@/lib/test-runs";

export const dynamic = "force-dynamic";

export const GET = withAuth(null, async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, id, PERMISSIONS.TEST_RUN_METRICS_VIEW, activeOrganizationId, organizationRole);
  if (access.error) return access.error;

  const metrics = await upsertRunMetrics(prisma, id);
  return NextResponse.json(metrics);
});

export const POST = withAuth(null, async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, id, PERMISSIONS.TEST_RUN_METRICS_UPDATE, activeOrganizationId, organizationRole);
  if (access.error) return access.error;

  try {
    const metrics = await upsertRunMetrics(prisma, id);
    return NextResponse.json(metrics);
  } catch {
    return NextResponse.json(
      { message: "Could not recalculate metrics." },
      { status: 500 },
    );
  }
});


