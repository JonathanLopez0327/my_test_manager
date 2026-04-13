import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { hash } from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      fullName?: string;
      password?: string;
    };

    const fullName = body.fullName?.trim();
    const password = body.password?.trim();

    if (password && password.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const data: { fullName?: string | null; passwordHash?: string } = {};

    if (fullName !== undefined) {
      data.fullName = fullName || null;
    }

    if (password) {
      data.passwordHash = await hash(password, 10);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "Could not update profile." },
      { status: 500 },
    );
  }
}
