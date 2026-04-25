import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  normalizeLocale,
  type Locale,
} from "./config";
import { getMessages, type Messages } from "./messages";

export async function resolveLocale(): Promise<Locale> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { locale: true },
      });
      if (user?.locale && isLocale(user.locale)) {
        return user.locale;
      }
    } catch {
      // fall through to cookie
    }
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (fromCookie) {
    return normalizeLocale(fromCookie);
  }

  return DEFAULT_LOCALE;
}

export async function getT(): Promise<Messages> {
  const locale = await resolveLocale();
  return getMessages(locale);
}
