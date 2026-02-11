import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

function parseDisplayOrder(value?: number | null) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const PUT = withAuth(null, async (req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;

  try {
    const existing = await prisma.testSuite.findUnique({
      where: { id },
      select: {
        testPlanId: true,
        testPlan: { select: { projectId: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Suite no encontrada." },
        { status: 404 },
      );
    }

    const body = (await req.json()) as {
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

    // Check permission on current project
    await requirePerm(PERMISSIONS.TEST_SUITE_UPDATE, {
      userId,
      globalRoles,
      projectId: existing.testPlan.projectId,
    });

    // If moving to a different plan/project, check permission there too
    if (testPlanId !== existing.testPlanId) {
      await requirePerm(PERMISSIONS.TEST_SUITE_UPDATE, {
        userId,
        globalRoles,
        projectId: targetPlan.projectId,
      });
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
    if (error instanceof AuthorizationError) throw error;
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
});

export const DELETE = withAuth(null, async (_req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;

  try {
    const existing = await prisma.testSuite.findUnique({
      where: { id },
      select: {
        testPlan: { select: { projectId: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Suite no encontrada." },
        { status: 404 },
      );
    }

    await requirePerm(PERMISSIONS.TEST_SUITE_DELETE, {
      userId,
      globalRoles,
      projectId: existing.testPlan.projectId,
    });

    await prisma.testSuite.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "No se pudo eliminar la suite." },
      { status: 500 },
    );
  }
});
