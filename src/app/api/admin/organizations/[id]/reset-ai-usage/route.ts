import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";
import { ensureCurrentPeriod } from "@/lib/ai/usage";

export const POST = withAuth(null, async (_req, { globalRoles }, { params }) => {
  if (!globalRoles.includes("super_admin")) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;

  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!org) {
    return NextResponse.json({ message: "Organization not found." }, { status: 404 });
  }

  try {
    const period = await ensureCurrentPeriod(org.id);

    const zero = BigInt(0);
    const updated = await prisma.aiUsagePeriod.update({
      where: { id: period.id },
      data: {
        inputTokens: zero,
        outputTokens: zero,
        totalTokens: zero,
      },
    });

    return NextResponse.json({
      ok: true,
      organizationId: org.id,
      periodStart: updated.periodStart,
      periodEnd: updated.periodEnd,
      inputTokens: updated.inputTokens.toString(),
      outputTokens: updated.outputTokens.toString(),
      totalTokens: updated.totalTokens.toString(),
    });
  } catch (err) {
    console.error("[ai-usage] reset failed:", err);
    return NextResponse.json(
      { message: "Could not reset AI usage." },
      { status: 500 },
    );
  }
});
