"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/config";

type ProvidersProps = {
  children: ReactNode;
  locale: Locale;
};

export function Providers({ children, locale }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <SessionProvider>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
