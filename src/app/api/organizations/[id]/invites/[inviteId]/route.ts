import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";
import { InviteError, revokeInvite } from "@/lib/invites/invite-service";

export const DELETE = withAuth(null, async (_req, authCtx, routeCtx) => {
  const { id, inviteId } = await routeCtx.params;

  const allowed = await can(PERMISSIONS.ORG_INVITE_MANAGE, {
    userId: authCtx.userId,
    globalRoles: authCtx.globalRoles,
    organizationId: id,
    organizationRole: authCtx.organizationRole,
  });

  if (!allowed) {
    return NextResponse.json(
      { message: "You do not have permission to manage invites." },
      { status: 403 },
    );
  }

  try {
    await revokeInvite(inviteId, id, authCtx.userId, prisma);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InviteError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[invites] revoke failed", error);
    return NextResponse.json(
      { message: "Could not revoke the invite." },
      { status: 500 },
    );
  }
});
