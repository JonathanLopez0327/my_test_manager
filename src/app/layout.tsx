import type { Metadata } from "next";
import { Providers } from "./providers";
import { resolveLocale } from "@/lib/i18n/server";
import "@/css/satoshi.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Test Manager",
  description: "Test management dashboard",
  icons: {
    icon: "/brand/icon_logo.png",
    apple: "/brand/icon_logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await resolveLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="font-satoshi antialiased">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
