import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const GET = withAuth(PERMISSIONS.USER_LIST, async (req, { userId, globalRoles }) => {
  const { searchParams } = new URL(req.url);
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
});

export const POST = withAuth(PERMISSIONS.USER_CREATE, async (req) => {
  try {
    const body = (await req.json()) as {
      email?: string;
      fullName?: string | null;
      password?: string;
      isActive?: boolean;
      memberships?: { projectId: string; role: "admin" | "editor" | "viewer" }[];
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const memberships = body.memberships ?? [];

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email y contraseña son requeridos." },
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

      if (memberships.length > 0) {
        await tx.projectMember.createMany({
          data: memberships.map((m) => ({
            userId: user.id,
            projectId: m.projectId,
            role: m.role,
          })),
        });
      }

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
});
