import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
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

function parseDisplayOrder(value?: number | null) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  try {
    const existing = await prisma.testSuite.findUnique({
      where: { id },
      select: {
        testPlanId: true,
        testPlan: {
          select: {
            projectId: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Suite no encontrada." },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      testPlanId?: string;
      parentSuiteId?: string | null;
      name?: string;
      description?: string | null;
      displayOrder?: number | null;
    };

    const testPlanId = body.testPlanId?.trim();
    const parentSuiteId = body.parentSuiteId?.trim() || null;
    const name = body.name?.trim();

    if (!testPlanId || !name) {
      return NextResponse.json(
        { message: "Plan y nombre son requeridos." },
        { status: 400 },
      );
    }

    if (parentSuiteId === id) {
      return NextResponse.json(
        { message: "La suite no puede ser su propio padre." },
        { status: 400 },
      );
    }

    const targetPlan =
      testPlanId === existing.testPlanId
        ? existing.testPlan
        : await prisma.testPlan.findUnique({
            where: { id: testPlanId },
            select: { projectId: true },
          });

    if (!targetPlan) {
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
      const currentRole = await getProjectRole(
        session.user.id,
        existing.testPlan.projectId,
      );
      if (!hasProjectPermission(currentRole, "editor")) {
        return NextResponse.json(
          { message: "No tienes permisos para editar esta suite." },
          { status: 403 },
        );
      }
      if (testPlanId !== existing.testPlanId) {
        const targetRole = await getProjectRole(
          session.user.id,
          targetPlan.projectId,
        );
        if (!hasProjectPermission(targetRole, "editor")) {
          return NextResponse.json(
            { message: "No tienes permisos en el plan destino." },
            { status: 403 },
          );
        }
      }
    }

    if (parentSuiteId) {
      const parent = await prisma.testSuite.findUnique({
        where: { id: parentSuiteId },
        select: { id: true, testPlanId: true },
      });
      if (!parent || parent.testPlanId !== testPlanId) {
        return NextResponse.json(
          { message: "Suite padre inválida." },
          { status: 400 },
        );
      }
    }

    const suite = await prisma.testSuite.update({
      where: { id },
      data: {
        testPlanId,
        parentSuiteId,
        name,
        description: body.description?.trim() || null,
        displayOrder: parseDisplayOrder(body.displayOrder),
      },
    });

    return NextResponse.json(suite);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Ya existe una suite con ese nombre en el plan." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo actualizar la suite." },
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
    const existing = await prisma.testSuite.findUnique({
      where: { id },
      select: {
        testPlan: {
          select: { projectId: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Suite no encontrada." },
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
      const role = await getProjectRole(
        session.user.id,
        existing.testPlan.projectId,
      );
      if (!hasProjectPermission(role, "admin")) {
        return NextResponse.json(
          { message: "No tienes permisos para eliminar esta suite." },
          { status: 403 },
        );
      }
    }

    await prisma.testSuite.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: "No se pudo eliminar la suite." },
      { status: 500 },
    );
  }
}
