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
    select: { aiTokenLimitMonthly: true, maxArtifactBytes: true },
  });

  if (!org) {
    return NextResponse.json({ message: "Organization not found." }, { status: 404 });
  }

  const period = await ensureCurrentPeriod(activeOrganizationId);

  const [runAgg, bugAgg] = await prisma.$transaction([
    prisma.testRunArtifact.aggregate({
      _sum: { sizeBytes: true },
      where: { run: { project: { organizationId: activeOrganizationId } } },
    }),
    prisma.bugAttachment.aggregate({
      _sum: { sizeBytes: true },
      where: { bug: { project: { organizationId: activeOrganizationId } } },
    }),
  ]);

  const runBytes = runAgg._sum.sizeBytes ?? BigInt(0);
  const bugBytes = bugAgg._sum.sizeBytes ?? BigInt(0);
  const storageUsed = runBytes + bugBytes;

  return NextResponse.json({
    limit: org.aiTokenLimitMonthly,
    periodStart: period.periodStart.toISOString(),
    periodEnd: period.periodEnd.toISOString(),
    inputTokens: period.inputTokens.toString(),
    outputTokens: period.outputTokens.toString(),
    totalTokens: period.totalTokens.toString(),
    storageLimit: org.maxArtifactBytes.toString(),
    storageUsed: storageUsed.toString(),
  });
});
