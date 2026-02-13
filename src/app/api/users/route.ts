import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { anyGlobalRoleHasPermission } from "@/lib/auth/role-permissions.map";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const GET = withAuth(PERMISSIONS.USER_LIST, async (req, { userId, globalRoles, activeOrganizationId }) => {
  const { searchParams } = new URL(req.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const query = searchParams.get("query")?.trim();

  const isSuperAdmin = anyGlobalRoleHasPermission(
    globalRoles,
    PERMISSIONS.USER_CREATE,
  );

  const filters: Prisma.UserWhereInput[] = [];

  if (query) {
    filters.push({
      OR: [
        { email: { contains: query, mode: "insensitive" } },
        { fullName: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  // Scope user listing to org members (unless super_admin)
  if (activeOrganizationId && !isSuperAdmin) {
    filters.push({
      organizationMemberships: {
        some: { organizationId: activeOrganizationId },
      },
    });
  }

  const where: Prisma.UserWhereInput = filters.length
    ? { AND: filters }
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
        organizationMemberships: {
          select: {
            role: true,
            organization: {
              select: {
                id: true,
                slug: true,
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
      memberships: user.organizationMemberships.map((membership) => ({
        organizationId: membership.organization.id,
        organizationSlug: membership.organization.slug,
        organizationName: membership.organization.name,
        role: membership.role,
      })),
    })),
    total,
    page,
    pageSize,
  });
});

export const POST = withAuth(PERMISSIONS.USER_CREATE, async (req, { activeOrganizationId }) => {
  try {
    const body = (await req.json()) as {
      email?: string;
      fullName?: string | null;
      password?: string;
      isActive?: boolean;
      memberships?: { organizationId: string; role: "owner" | "admin" | "member" | "billing" }[];
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
        await tx.organizationMember.createMany({
          data: memberships.map((m) => ({
            userId: user.id,
            organizationId: m.organizationId,
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
        { message: "Organización inválida." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo crear el usuario." },
      { status: 500 },
    );
  }
});
