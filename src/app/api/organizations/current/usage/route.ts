import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { prisma } from "@/lib/prisma";
import { ensureCurrentPeriod } from "@/lib/ai/usage";

export const runtime = "nodejs";

export const GET = withAuth(PERMISSIONS.ORG_LIST, async (_req, authCtx) => {
  const { activeOrganizationId } = authCtx;

  if (!activeOrganizationId) {
    return NextResponse.json(
      { message: "You do not have an active organization." },
      { status: 403 },
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: activeOrganizationId },
    select: { aiTokenLimitMonthly: true },
  });

  if (!org) {
    return NextResponse.json({ message: "Organization not found." }, { status: 404 });
  }

  const period = await ensureCurrentPeriod(activeOrganizationId);

  return NextResponse.json({
    limit: org.aiTokenLimitMonthly,
    periodStart: period.periodStart.toISOString(),
    periodEnd: period.periodEnd.toISOString(),
    inputTokens: period.inputTokens.toString(),
    outputTokens: period.outputTokens.toString(),
    totalTokens: period.totalTokens.toString(),
  });
});
