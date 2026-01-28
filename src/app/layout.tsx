import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const displayFont = Sora({
  variable: "--font-display",
  subsets: ["latin"],
});

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
    <html lang="en">
      <body className={`${displayFont.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
