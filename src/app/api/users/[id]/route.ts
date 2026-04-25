import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { checkPasswordPolicy } from "@/lib/schemas/password";
import { hashPassword } from "@/lib/auth/password-hash";

export const PUT = withAuth(PERMISSIONS.USER_UPDATE, async (req, { userId: requesterId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;

  // Editing arbitrary users (password, isActive, cross-org memberships) is a
  // super_admin-only operation. Org owners must use org-scoped membership
  // endpoints to manage their own organization's roster.
  if (!globalRoles.includes("super_admin")) {
    return NextResponse.json(
      { message: "Forbidden." },
      { status: 403 },
    );
  }

  try {
    const body = (await req.json()) as {
      fullName?: string | null;
      isActive?: boolean;
      password?: string;
      memberships?: { organizationId: string; role: "owner" | "admin" | "member" | "billing" }[];
    };

    if (id === requesterId && body.isActive === false) {
      return NextResponse.json(
        { message: "You cannot deactivate your own account." },
        { status: 400 },
      );
    }

    const memberships = body.memberships ?? [];
    const password = body.password?.trim();

    if (password) {
      const policy = checkPasswordPolicy(password);
      if (!policy.ok) {
        return NextResponse.json(
          { message: policy.message, code: policy.code },
          { status: 400 },
        );
      }
    }

    const passwordHash = password ? await hashPassword(password) : null;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          fullName: body.fullName?.trim() || null,
          isActive: body.isActive ?? true,
          ...(passwordHash ? { passwordHash } : {}),
        },
      });

      // Update memberships: delete all existing and create new ones
      await tx.organizationMember.deleteMany({
        where: { userId: id },
      });

      if (memberships.length > 0) {
        await tx.organizationMember.createMany({
          data: memberships.map((m) => ({
            userId: id,
            organizationId: m.organizationId,
            role: m.role,
          })),
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { message: "Invalid organization." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "Could not update the user." },
      { status: 500 },
    );
  }
});
