import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, TestPlanStatus } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { require as requirePerm, AuthorizationError } from "@/lib/auth/policy-engine";
import { withAuth } from "@/lib/auth/with-auth";

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

export const PUT = withAuth(null, async (req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;

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

    const body = (await req.json()) as {
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

    // Check permission on the current project
    await requirePerm(PERMISSIONS.TEST_PLAN_UPDATE, {
      userId,
      globalRoles,
      projectId: existing.projectId,
    });

    // If moving to a different project, also check permission there
    if (projectId && projectId !== existing.projectId) {
      await requirePerm(PERMISSIONS.TEST_PLAN_UPDATE, {
        userId,
        globalRoles,
        projectId,
      });
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
    if (error instanceof AuthorizationError) throw error;
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
});

export const DELETE = withAuth(null, async (_req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;

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

    await requirePerm(PERMISSIONS.TEST_PLAN_DELETE, {
      userId,
      globalRoles,
      projectId: existing.projectId,
    });

    await prisma.testPlan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    return NextResponse.json(
      { message: "No se pudo eliminar el plan." },
      { status: 500 },
    );
  }
});
