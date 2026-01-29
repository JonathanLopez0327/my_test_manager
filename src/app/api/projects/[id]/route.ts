import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getGlobalRoles,
  isProjectAdmin,
  isReadOnlyGlobal,
  isSuperAdmin,
} from "@/lib/permissions";

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
    if (isReadOnlyGlobal(globalRoles)) {
      return NextResponse.json(
        { message: "Solo lectura." },
        { status: 403 },
      );
    }
    const isAdmin = await isProjectAdmin(session.user.id, id);
    if (!isAdmin) {
      return NextResponse.json(
        { message: "No tienes permisos para editar este proyecto." },
        { status: 403 },
      );
    }
  }

  try {
    const body = (await request.json()) as {
      key?: string;
      name?: string;
      description?: string | null;
      isActive?: boolean;
    };

    const key = body.key?.trim().toUpperCase();
    const name = body.name?.trim();

    if (!key || !name) {
      return NextResponse.json(
        { message: "Key y nombre son requeridos." },
        { status: 400 },
      );
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        key,
        name,
        description: body.description?.trim() || null,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Ya existe un proyecto con ese key." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo actualizar el proyecto." },
      { status: 500 },
    );
  }
}

export async function DELETE(_: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const globalRoles = await getGlobalRoles(session.user.id);
  if (!isSuperAdmin(globalRoles)) {
    if (isReadOnlyGlobal(globalRoles)) {
      return NextResponse.json(
        { message: "Solo lectura." },
        { status: 403 },
      );
    }
    const isAdmin = await isProjectAdmin(session.user.id, id);
    if (!isAdmin) {
      return NextResponse.json(
        { message: "No tienes permisos para eliminar este proyecto." },
        { status: 403 },
      );
    }
  }

  try {
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: "No se pudo eliminar el proyecto." },
      { status: 500 },
    );
  }
}
