import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const locale = body?.locale;

  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  if (session?.user?.id) {
    await prisma.user
      .update({ where: { id: session.user.id }, data: { locale } })
      .catch(() => {
        // cookie already set; swallow DB error
      });
  }

  return response;
}
