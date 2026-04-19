import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";
import {
  createInvite,
  InviteError,
  listOrgInvites,
} from "@/lib/invites/invite-service";

const INVITABLE_ROLES: OrgRole[] = ["admin", "member", "billing"];

export const GET = withAuth(null, async (_req, authCtx, routeCtx) => {
  const { id } = await routeCtx.params;

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

  const items = await listOrgInvites(id, prisma);
  return NextResponse.json({ items });
});

export const POST = withAuth(null, async (req, authCtx, routeCtx) => {
  const { id } = await routeCtx.params;

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

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    role?: OrgRole;
  } | null;

  if (!body || !body.email) {
    return NextResponse.json(
      { message: "Email is required." },
      { status: 400 },
    );
  }

  const role: OrgRole =
    body.role && INVITABLE_ROLES.includes(body.role) ? body.role : "member";

  try {
    const invite = await createInvite(
      {
        organizationId: id,
        email: body.email,
        role,
        invitedById: authCtx.userId,
      },
      prisma,
    );
    return NextResponse.json(invite, { status: 201 });
  } catch (error) {
    if (error instanceof InviteError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[invites] create failed", error);
    return NextResponse.json(
      { message: "Could not create the invite." },
      { status: 500 },
    );
  }
});
