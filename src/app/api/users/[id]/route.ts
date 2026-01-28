import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGlobalRoles, isSuperAdmin } from "@/lib/permissions";

type RouteParams = {
  params: {
    id: string;
  };
};

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = params;
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
      projectId?: string;
      projectRole?: "admin" | "editor" | "viewer";
    };

    const projectId = body.projectId?.trim();
    const projectRole = body.projectRole ?? "viewer";
    const password = body.password?.trim();

    if (!projectId) {
      return NextResponse.json(
        { message: "Proyecto es requerido." },
        { status: 400 },
      );
    }

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

      await tx.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId,
            userId: id,
          },
        },
        update: {
          role: projectRole,
        },
        create: {
          projectId,
          userId: id,
          role: projectRole,
        },
      });
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
