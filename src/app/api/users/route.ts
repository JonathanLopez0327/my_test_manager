import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getGlobalRoles,
  isReadOnlyGlobal,
  isSuperAdmin,
} from "@/lib/permissions";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const globalRoles = await getGlobalRoles(session.user.id);
  const canView = isSuperAdmin(globalRoles) || isReadOnlyGlobal(globalRoles);
  if (!canView) {
    return NextResponse.json(
      { message: "No tienes permisos para ver usuarios." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const query = searchParams.get("query")?.trim();

  const where: Prisma.UserWhereInput = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { fullName: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        createdAt: true,
        globalRoles: {
          select: { role: true },
        },
        projectMemberships: {
          select: {
            role: true,
            project: {
              select: {
                id: true,
                key: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      createdAt: user.createdAt,
      globalRoles: user.globalRoles.map((role) => role.role),
      memberships: user.projectMemberships.map((membership) => ({
        projectId: membership.project.id,
        projectKey: membership.project.key,
        projectName: membership.project.name,
        role: membership.role,
      })),
    })),
    total,
    page,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const globalRoles = await getGlobalRoles(session.user.id);
  if (!isSuperAdmin(globalRoles)) {
    return NextResponse.json(
      { message: "No tienes permisos para crear usuarios." },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as {
      email?: string;
      fullName?: string | null;
      password?: string;
      isActive?: boolean;
      projectId?: string;
      projectRole?: "admin" | "editor" | "viewer";
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const projectId = body.projectId?.trim();
    const projectRole = body.projectRole ?? "viewer";

    if (!email || !password || !projectId) {
      return NextResponse.json(
        { message: "Email, contraseña y proyecto son requeridos." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 },
      );
    }

    const passwordHash = await hash(password, 10);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          fullName: body.fullName?.trim() || null,
          passwordHash,
          isActive: body.isActive ?? true,
        },
      });

      await tx.projectMember.create({
        data: {
          userId: user.id,
          projectId,
          role: projectRole,
        },
      });

      return user;
    });

    return NextResponse.json(
      {
        id: created.id,
        email: created.email,
        fullName: created.fullName,
        isActive: created.isActive,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Ya existe un usuario con ese email." },
        { status: 409 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { message: "Proyecto inválido." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo crear el usuario." },
      { status: 500 },
    );
  }
}
