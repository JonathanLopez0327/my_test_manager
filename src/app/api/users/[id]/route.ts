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
      memberships?: { projectId: string; role: "admin" | "editor" | "viewer" }[];
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
      await tx.projectMember.deleteMany({
        where: { userId: id },
      });

      if (memberships.length > 0) {
        await tx.projectMember.createMany({
          data: memberships.map((m) => ({
            userId: id,
            projectId: m.projectId,
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
        { message: "Proyecto inválido." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo actualizar el usuario." },
      { status: 500 },
    );
  }
});
