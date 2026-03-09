import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";

export const POST = withAuth(null, async (req, { userId }) => {
  const body = (await req.json()) as { organizationId?: string };
  const organizationId = body.organizationId?.trim();

  if (!organizationId) {
    return NextResponse.json(
      { message: "El ID de la organization es requerido." },
      { status: 400 },
    );
  }

  // Validate membership
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    include: {
      organization: {
        select: { id: true, slug: true, name: true, isActive: true },
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { message: "You are not a member of this organization." },
      { status: 403 },
    );
  }

  if (!membership.organization.isActive) {
    return NextResponse.json(
      { message: "This organization is not active." },
      { status: 403 },
    );
  }

  // Return org info — the client should call `update()` on the session
  // with { activeOrganizationId: organizationId } to trigger the JWT callback
  return NextResponse.json({
    activeOrganizationId: membership.organizationId,
    organizationRole: membership.role,
    organization: membership.organization,
  });
});



