import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";
import {
  consumeInviteForUser,
  InviteError,
} from "@/lib/invites/invite-service";

/**
 * Authenticated endpoint — consumes the invite for the current user, adding
 * them to the target organization with the invited role. The session's email
 * must match the invite email.
 */
export const POST = withAuth(null, async (_req, authCtx, routeCtx) => {
  const { token } = await routeCtx.params;

  const user = await prisma.user.findUnique({
    where: { id: authCtx.userId },
    select: { email: true },
  });

  if (!user) {
    return NextResponse.json(
      { message: "User not found." },
      { status: 404 },
    );
  }

  try {
    const result = await consumeInviteForUser(
      token,
      authCtx.userId,
      user.email,
      prisma,
    );
    return NextResponse.json({
      organizationId: result.organizationId,
      organizationSlug: result.organizationSlug,
      role: result.role,
    });
  } catch (error) {
    if (error instanceof InviteError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[invites] accept failed", error);
    return NextResponse.json(
      { message: "Could not accept the invite." },
      { status: 500 },
    );
  }
});
