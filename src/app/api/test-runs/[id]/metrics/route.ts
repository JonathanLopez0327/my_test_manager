import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  getGlobalRoles,
  getProjectRole,
  hasProjectPermission,
  isReadOnlyGlobal,
  isSuperAdmin,
} from "@/lib/permissions";
import { serializeRunMetrics, upsertRunMetrics } from "@/lib/test-runs";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

async function requireRunAccess(
  userId: string,
  runId: string,
  requiredRole: "viewer" | "editor" | "admin",
) {
  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    select: { id: true, projectId: true },
  });

  if (!run) {
    return {
      error: NextResponse.json(
        { message: "Run no encontrado." },
        { status: 404 },
      ),
    };
  }

  const globalRoles = await getGlobalRoles(userId);
  if (isSuperAdmin(globalRoles)) {
    return { run };
  }

  if (isReadOnlyGlobal(globalRoles)) {
    if (requiredRole !== "viewer") {
      return {
        error: NextResponse.json({ message: "Solo lectura." }, { status: 403 }),
      };
    }
    return { run };
  }

  const role = await getProjectRole(userId, run.projectId);
  if (!hasProjectPermission(role, requiredRole)) {
    return {
      error: NextResponse.json(
        { message: "No tienes permisos en este proyecto." },
        { status: 403 },
      ),
    };
  }

  return { run };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const access = await requireRunAccess(session.user.id, id, "viewer");
  if (access.error) return access.error;

  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "true";

  if (refresh) {
    const metrics = await upsertRunMetrics(prisma, id);
    return NextResponse.json(metrics);
  }

  const metrics = await prisma.testRunMetrics.findUnique({
    where: { runId: id },
  });

  if (!metrics) {
    const refreshed = await upsertRunMetrics(prisma, id);
    return NextResponse.json(refreshed);
  }

  return NextResponse.json(serializeRunMetrics(metrics));
}

export async function POST(_: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const access = await requireRunAccess(session.user.id, id, "editor");
  if (access.error) return access.error;

  try {
    const metrics = await upsertRunMetrics(prisma, id);
    return NextResponse.json(metrics);
  } catch (error) {
    return NextResponse.json(
      { message: "No se pudieron recalcular las métricas." },
      { status: 500 },
    );
  }
}
