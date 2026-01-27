import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, TestPlanStatus } from "@/generated/prisma/client";

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
  try {
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
  try {
    await prisma.testPlan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: "No se pudo eliminar el plan." },
      { status: 500 },
    );
  }
}
