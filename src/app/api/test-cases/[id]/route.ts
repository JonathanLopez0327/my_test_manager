import { NextRequest, NextResponse } from "next/server"; // Force rebuild

import { prisma } from "@/lib/prisma";
import { TestCaseStatus } from "@/generated/prisma/client";
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
  params: Promise<{
    id: string;
  }>;
};

const STATUS_VALUES: TestCaseStatus[] = ["draft", "ready", "deprecated"];

function parseStatus(value?: string | null) {
  if (!value) return null;
  return STATUS_VALUES.includes(value as TestCaseStatus)
    ? (value as TestCaseStatus)
    : null;
}

function parsePriority(value?: number | null) {
  if (value === null || value === undefined) return 3;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(5, Math.max(1, Math.round(parsed)));
}

function normalizeSteps(value?: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const step = (item as any).step;
          const expectedResult = (item as any).expectedResult;
          if (typeof step === "string" || typeof expectedResult === "string") {
            return {
              step: String(step ?? "").trim(),
              expectedResult: String(expectedResult ?? "").trim(),
            };
          }
        }
        return String(item).trim();
      })
      .filter((item) => {
        if (typeof item === "string") return item.length > 0;
        return item.step || item.expectedResult;
      });
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  try {
    const existing = await prisma.testCase.findUnique({
      where: { id },
      select: {
        suiteId: true,
        suite: {
          select: {
            testPlan: {
              select: {
                projectId: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Caso no encontrado." },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      suiteId?: string;
      title?: string;
      description?: string | null;
      preconditions?: string | null;
      steps?: unknown;
      tags?: unknown;
      status?: TestCaseStatus;
      priority?: number | null;
      isAutomated?: boolean;
      automationType?: string | null;
      automationRef?: string | null;
    };

    const suiteId = body.suiteId?.trim();
    const title = body.title?.trim();
    const status = parseStatus(body.status ?? null) ?? "draft";
    const priority = parsePriority(body.priority);
    const steps = normalizeSteps(body.steps);
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter((t) => t.length > 0)
      : [];
    const isAutomated = Boolean(body.isAutomated);
    const automationType = body.automationType?.trim() || null;
    const automationRef = body.automationRef?.trim() || null;

    if (!suiteId || !title) {
      return NextResponse.json(
        { message: "Suite y título son requeridos." },
        { status: 400 },
      );
    }

    const targetSuite =
      suiteId === existing.suiteId
        ? existing.suite
        : await prisma.testSuite.findUnique({
          where: { id: suiteId },
          select: {
            testPlan: {
              select: {
                projectId: true,
              },
            },
          },
        });

    if (!targetSuite) {
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
      const currentRole = await getProjectRole(
        session.user.id,
        existing.suite.testPlan.projectId,
      );
      if (!hasProjectPermission(currentRole, "editor")) {
        return NextResponse.json(
          { message: "No tienes permisos para editar este caso." },
          { status: 403 },
        );
      }
      if (suiteId !== existing.suiteId) {
        const targetRole = await getProjectRole(
          session.user.id,
          targetSuite.testPlan.projectId,
        );
        if (!hasProjectPermission(targetRole, "editor")) {
          return NextResponse.json(
            { message: "No tienes permisos en la suite destino." },
            { status: 403 },
          );
        }
      }
    }

    const testCase = await prisma.testCase.update({
      where: { id },
      data: {
        suiteId,
        title,
        description: body.description?.trim() || null,
        preconditions: body.preconditions?.trim() || null,
        steps,
        tags,
        status,
        priority,
        isAutomated,
        automationType: isAutomated ? automationType : null,
        automationRef: isAutomated ? automationRef : null,
      },
    });

    return NextResponse.json(testCase);
  } catch (error) {
    return NextResponse.json(
      { message: "No se pudo actualizar el caso." },
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

  try {
    const existing = await prisma.testCase.findUnique({
      where: { id },
      select: {
        suite: {
          select: {
            testPlan: {
              select: {
                projectId: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Caso no encontrado." },
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
        existing.suite.testPlan.projectId,
      );
      if (!hasProjectPermission(role, "admin")) {
        return NextResponse.json(
          { message: "No tienes permisos para eliminar este caso." },
          { status: 403 },
        );
      }
    }

    await prisma.testCase.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: "No se pudo eliminar el caso." },
      { status: 500 },
    );
  }
}
