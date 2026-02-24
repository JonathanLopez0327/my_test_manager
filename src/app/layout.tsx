import type { Metadata } from "next";
import { Providers } from "./providers";
import "@/css/satoshi.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Test Manager",
  description: "Test management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-satoshi antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
