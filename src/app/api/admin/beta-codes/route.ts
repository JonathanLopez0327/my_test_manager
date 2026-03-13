import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";
import { generateBetaCode } from "@/lib/beta/generate-code";

export const GET = withAuth(null, async (req, { globalRoles }) => {
  if (!globalRoles.includes("super_admin")) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const used = searchParams.get("used");
  const email = searchParams.get("email")?.trim().toLowerCase();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));

  const where: Record<string, unknown> = {};
  if (used === "true") where.usedAt = { not: null };
  if (used === "false") where.usedAt = null;
  if (email) where.email = { contains: email, mode: "insensitive" };

  const [items, total] = await prisma.$transaction([
    prisma.betaCode.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        usedBy: { select: { id: true, email: true, fullName: true } },
        createdBy: { select: { id: true, email: true, fullName: true } },
      },
    }),
    prisma.betaCode.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
});

export const POST = withAuth(null, async (req, { userId, globalRoles }) => {
  if (!globalRoles.includes("super_admin")) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const body = (await req.json()) as {
    email?: string | null;
    expiresAt?: string | null;
    count?: number;
  };

  const count = Math.min(100, Math.max(1, Number(body.count) || 1));
  const email = body.email?.trim().toLowerCase() || null;
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ message: "Invalid expiresAt date." }, { status: 400 });
  }

  // Generate unique codes
  const codes: string[] = [];
  const attempts = count * 5;
  for (let i = 0; i < attempts && codes.length < count; i++) {
    codes.push(generateBetaCode());
  }

  const created = await prisma.betaCode.createMany({
    data: codes.map((code) => ({
      code,
      email,
      expiresAt,
      createdById: userId,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ created: created.count, codes }, { status: 201 });
});
