import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, TestPlanStatus } from "@/generated/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getGlobalRoles,
  getProjectRole,
  hasProjectPermission,
  isReadOnlyGlobal,
  isSuperAdmin,
} from "@/lib/permissions";

type RouteParams = {
  params: {
    id: string;
  };
};

const STATUS_VALUES: TestPlanStatus[] = [
  "draft",
  "active",
  "completed",
  "archived",
];

function parseStatus(value?: string | null) {
  if (!value) return null;
  return STATUS_VALUES.includes(value as TestPlanStatus)
    ? (value as TestPlanStatus)
    : null;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  try {
    const existing = await prisma.testPlan.findUnique({
      where: { id },
      select: { projectId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Plan no encontrado." },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      projectId?: string;
      name?: string;
      description?: string | null;
      status?: TestPlanStatus;
      startsOn?: string | null;
      endsOn?: string | null;
    };

    const projectId = body.projectId?.trim();
    const name = body.name?.trim();
    const status = parseStatus(body.status ?? null) ?? "draft";
    const startsOn = parseDate(body.startsOn ?? null);
    const endsOn = parseDate(body.endsOn ?? null);

    if (!projectId || !name) {
      return NextResponse.json(
        { message: "Proyecto y nombre son requeridos." },
        { status: 400 },
      );
    }

    if (body.startsOn && !startsOn) {
      return NextResponse.json(
        { message: "Fecha de inicio inválida." },
        { status: 400 },
      );
    }

    if (body.endsOn && !endsOn) {
      return NextResponse.json(
        { message: "Fecha de fin inválida." },
        { status: 400 },
      );
    }

    if (startsOn && endsOn && endsOn < startsOn) {
      return NextResponse.json(
        { message: "La fecha de fin debe ser posterior a la fecha de inicio." },
        { status: 400 },
      );
    }

    const globalRoles = await getGlobalRoles(session.user.id);
    if (!isSuperAdmin(globalRoles)) {
      if (isReadOnlyGlobal(globalRoles)) {
        return NextResponse.json(
          { message: "Solo lectura." },
          { status: 403 },
        );
      }
      const currentRole = await getProjectRole(
        session.user.id,
        existing.projectId,
      );
      if (!hasProjectPermission(currentRole, "editor")) {
        return NextResponse.json(
          { message: "No tienes permisos para editar este plan." },
          { status: 403 },
        );
      }
      if (projectId && projectId !== existing.projectId) {
        const targetRole = await getProjectRole(session.user.id, projectId);
        if (!hasProjectPermission(targetRole, "editor")) {
          return NextResponse.json(
            { message: "No tienes permisos en el proyecto destino." },
            { status: 403 },
          );
        }
      }
    }

    const plan = await prisma.testPlan.update({
      where: { id },
      data: {
        projectId,
        name,
        description: body.description?.trim() || null,
        status,
        startsOn,
        endsOn,
      },
    });

    return NextResponse.json(plan);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Ya existe un plan con ese nombre en el proyecto." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo actualizar el plan." },
      { status: 500 },
    );
  }
}

export async function DELETE(_: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  try {
    const existing = await prisma.testPlan.findUnique({
      where: { id },
      select: { projectId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Plan no encontrado." },
        { status: 404 },
      );
    }

    const globalRoles = await getGlobalRoles(session.user.id);
    if (!isSuperAdmin(globalRoles)) {
      if (isReadOnlyGlobal(globalRoles)) {
        return NextResponse.json(
          { message: "Solo lectura." },
          { status: 403 },
        );
      }
      const role = await getProjectRole(session.user.id, existing.projectId);
      if (!hasProjectPermission(role, "admin")) {
        return NextResponse.json(
          { message: "No tienes permisos para eliminar este plan." },
          { status: 403 },
        );
      }
    }

    await prisma.testPlan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: "No se pudo eliminar el plan." },
      { status: 500 },
    );
  }
}
