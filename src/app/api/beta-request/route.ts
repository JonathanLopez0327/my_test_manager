import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBetaCode } from "@/lib/beta/generate-code";
import { sendBetaCodeEmail } from "@/lib/email/send";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const email = (body as Record<string, unknown>)?.email;
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ message: "A valid email address is required." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Reuse an existing unused, non-expired code if one exists
    const existing = await prisma.betaCode.findFirst({
      where: {
        email: normalizedEmail,
        usedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    const code = existing
      ? existing.code
      : await (async () => {
          const newCode = generateBetaCode();
          await prisma.betaCode.create({
            data: { code: newCode, email: normalizedEmail },
          });
          return newCode;
        })();

    await sendBetaCodeEmail(normalizedEmail, code);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[beta-request] failed:", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
