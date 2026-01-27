import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

type RouteParams = {
  params: {
    id: string;
  };
};

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = params;
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
  const { id } = params;
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
