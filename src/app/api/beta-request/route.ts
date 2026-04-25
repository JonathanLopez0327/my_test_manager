import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBetaCode } from "@/lib/beta/generate-code";
import { sendBetaCodeEmail } from "@/lib/email/send";
import { clientIpFromHeaders, rateLimit } from "@/lib/api/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  // Public, unauthenticated endpoint that triggers an outbound email through
  // Resend on every call. Throttle aggressively to keep an attacker from
  // mailbombing victims via our domain or burning our Resend quota.
  const ip = clientIpFromHeaders(req.headers);
  const limited = rateLimit(
    { key: "beta-request", capacity: 3, refillPerSecond: 1 / 60 },
    ip,
  );
  if (!limited.allowed) {
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      },
    );
  }

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

  // Second limiter keyed by destination email so an IP rotation cannot be
  // used to mailbomb a specific victim.
  const emailLimited = rateLimit(
    { key: "beta-request:email", capacity: 2, refillPerSecond: 1 / 600 },
    normalizedEmail,
  );
  if (!emailLimited.allowed) {
    return NextResponse.json(
      { message: "Too many requests for this email. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(emailLimited.retryAfterSeconds) },
      },
    );
  }

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
