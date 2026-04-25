import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { compare } from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPasswordPolicy } from "@/lib/schemas/password";
import { hashPassword } from "@/lib/auth/password-hash";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      fullName?: string;
      password?: string;
      currentPassword?: string;
    };

    const fullName = body.fullName?.trim();
    const password = body.password?.trim();
    const currentPassword = body.currentPassword;

    if (password) {
      const policy = checkPasswordPolicy(password);
      if (!policy.ok) {
        return NextResponse.json(
          { message: policy.message, code: policy.code },
          { status: 400 },
        );
      }
    }

    const data: { fullName?: string | null; passwordHash?: string } = {};

    if (fullName !== undefined) {
      data.fullName = fullName || null;
    }

    if (password) {
      // Require knowledge of the current password before accepting a new one,
      // so a hijacked session cannot silently take over the account.
      if (!currentPassword) {
        return NextResponse.json(
          { message: "Current password is required to change your password." },
          { status: 400 },
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { passwordHash: true },
      });

      if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      const valid = await compare(currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { message: "Current password is incorrect." },
          { status: 400 },
        );
      }

      data.passwordHash = await hashPassword(password);
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
