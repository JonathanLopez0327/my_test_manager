import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";

export const GET = withAuth(null, async (_req, { globalRoles }, routeCtx) => {
  if (!globalRoles.includes("super_admin")) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { id } = await routeCtx.params;
  const code = await prisma.betaCode.findUnique({
    where: { id },
    include: {
      usedBy: { select: { id: true, email: true, fullName: true } },
      createdBy: { select: { id: true, email: true, fullName: true } },
    },
  });

  if (!code) {
    return NextResponse.json({ message: "Beta code not found." }, { status: 404 });
  }

  return NextResponse.json(code);
});

export const PATCH = withAuth(null, async (req, { globalRoles }, routeCtx) => {
  if (!globalRoles.includes("super_admin")) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { id } = await routeCtx.params;
  const body = (await req.json()) as {
    expiresAt?: string | null;
    email?: string | null;
  };

  const data: Record<string, unknown> = {};

  if ("expiresAt" in body) {
    if (body.expiresAt === null) {
      data.expiresAt = null;
    } else {
      const parsed = new Date(body.expiresAt!);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ message: "Invalid expiresAt date." }, { status: 400 });
      }
      data.expiresAt = parsed;
    }
  }

  if ("email" in body) {
    data.email = body.email?.trim().toLowerCase() || null;
  }

  const updated = await prisma.betaCode.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
});

export const DELETE = withAuth(null, async (_req, { globalRoles }, routeCtx) => {
  if (!globalRoles.includes("super_admin")) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { id } = await routeCtx.params;

  // Soft delete: set expiresAt to now() to revoke access while preserving audit trail
  const revoked = await prisma.betaCode.update({
    where: { id },
    data: { expiresAt: new Date() },
  });

  return NextResponse.json(revoked);
});
