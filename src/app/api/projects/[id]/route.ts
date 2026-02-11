import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

export const PUT = withAuth(null, async (req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;

  await requirePerm(PERMISSIONS.PROJECT_UPDATE, {
    userId,
    globalRoles,
    projectId: id,
  });

  try {
    const body = (await req.json()) as {
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
    if (error instanceof AuthorizationError) throw error;
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
});

export const DELETE = withAuth(null, async (_req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;

  await requirePerm(PERMISSIONS.PROJECT_DELETE, {
    userId,
    globalRoles,
    projectId: id,
  });

  try {
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "No se pudo eliminar el proyecto." },
      { status: 500 },
    );
  }
});
