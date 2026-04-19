import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { can } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

const VALID_ROLES: OrgRole[] = ["owner", "admin", "member", "billing"];

export const PUT = withAuth(null, async (req, authCtx, routeCtx) => {
  const { id, userId: targetUserId } = await routeCtx.params;

  const allowed = await can(PERMISSIONS.ORG_MEMBER_MANAGE, {
    userId: authCtx.userId,
    globalRoles: authCtx.globalRoles,
    organizationId: id,
    organizationRole: authCtx.organizationRole,
  });

  if (!allowed) {
    return NextResponse.json(
      { message: "You do not have permission to manage members." },
      { status: 403 },
    );
  }

  if (targetUserId === authCtx.userId) {
    return NextResponse.json(
      { message: "You cannot change your own role." },
      { status: 400 },
    );
  }

  const body = (await req.json()) as { role?: OrgRole };

  if (!body.role || !VALID_ROLES.includes(body.role)) {
    return NextResponse.json(
      { message: "Invalid role." },
      { status: 400 },
    );
  }

  // Prevent removing the last owner
  if (body.role !== "owner") {
    const existing = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: id, userId: targetUserId } },
    });
    if (existing?.role === "owner") {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId: id, role: "owner" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { message: "Cannot change the role of the last owner." },
          { status: 400 },
        );
      }
    }
  }

  try {
    const updated = await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: id, userId: targetUserId } },
      data: { role: body.role },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { message: "Could not update the member." },
      { status: 500 },
    );
  }
});

export const DELETE = withAuth(null, async (_req, authCtx, routeCtx) => {
  const { id, userId: targetUserId } = await routeCtx.params;

  const allowed = await can(PERMISSIONS.ORG_MEMBER_MANAGE, {
    userId: authCtx.userId,
    globalRoles: authCtx.globalRoles,
    organizationId: id,
    organizationRole: authCtx.organizationRole,
  });

  if (!allowed) {
    return NextResponse.json(
      { message: "You do not have permission to manage members." },
      { status: 403 },
    );
  }

  if (targetUserId === authCtx.userId) {
    return NextResponse.json(
      { message: "You cannot remove yourself from the organization." },
      { status: 400 },
    );
  }

  // Prevent removing the last owner
  const existing = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: id, userId: targetUserId } },
  });

  if (!existing) {
    return NextResponse.json(
      { message: "Member not found." },
      { status: 404 },
    );
  }

  if (existing.role === "owner") {
    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId: id, role: "owner" },
    });
    if (ownerCount <= 1) {
      return NextResponse.json(
        { message: "Cannot remove the last owner." },
        { status: 400 },
      );
    }
  }

  try {
    await prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId: id, userId: targetUserId } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "Could not remove the member." },
      { status: 500 },
    );
  }
});


