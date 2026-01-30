import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGlobalRoles, isSuperAdmin } from "@/lib/permissions";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const globalRoles = await getGlobalRoles(session.user.id);
  if (!isSuperAdmin(globalRoles)) {
    return NextResponse.json(
      { message: "No tienes permisos para modificar usuarios." },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as {
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
}
