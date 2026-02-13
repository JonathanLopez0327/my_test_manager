import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";

export const PUT = withAuth(PERMISSIONS.USER_UPDATE, async (req, _authCtx, routeCtx) => {
  const { id } = await routeCtx.params;

  try {
    const body = (await req.json()) as {
      fullName?: string | null;
      isActive?: boolean;
      password?: string;
      memberships?: { organizationId: string; role: "owner" | "admin" | "member" | "billing" }[];
    };

    const memberships = body.memberships ?? [];
    const password = body.password?.trim();

    const passwordHash =
      password && password.length >= 8 ? await hash(password, 10) : null;

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
        { message: "Organización inválida." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo actualizar el usuario." },
      { status: 500 },
    );
  }
});
