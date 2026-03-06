import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-auth";
import { prisma } from "@/lib/prisma";

export const DELETE = withAuth(null, async (_req, { userId }, routeCtx) => {
  const { id } = await routeCtx.params;

  const token = await prisma.apiToken.findFirst({
    where: { id, userId },
    select: {
      id: true,
      isActive: true,
      revokedAt: true,
    },
  });

  if (!token) {
    return NextResponse.json(
      { message: "Token no encontrado." },
      { status: 404 },
    );
  }

  if (!token.isActive || token.revokedAt) {
    return NextResponse.json({ ok: true, alreadyRevoked: true });
  }

  await prisma.apiToken.update({
    where: { id: token.id },
    data: {
      isActive: false,
      revokedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
});
