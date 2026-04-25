import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/Button";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsTOC } from "@/components/docs/DocsTOC";
import { MobileDocsNav } from "@/components/docs/MobileDocsNav";
import { resolveLocale } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/messages";

export const metadata: Metadata = {
  title: {
    default: "Docs | Test Manager",
    template: "%s | Test Manager Docs",
  },
  description:
    "Guides for Test Manager: planning, execution, AI workspace, and building agents on top of your QA workflow.",
};

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveLocale();
  const t = getMessages(locale);
  return (
    <div className="relative min-h-screen bg-canvas text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,_rgba(90,168,255,0.10),_transparent_55%),radial-gradient(ellipse_at_top_left,_rgba(109,89,255,0.08),_transparent_45%)]"
      />

      <header className="sticky top-0 z-40 border-b border-stroke/70 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" aria-label="Test Manager home" className="shrink-0">
              <BrandLogo variant="full" className="h-9 w-auto" />
            </Link>
            <span
              aria-hidden="true"
              className="hidden h-6 w-px bg-stroke sm:block"
            />
            <Link
              href="/docs"
              className="hidden text-sm font-semibold tracking-tight text-ink sm:inline-flex"
            >
              {t.docs.chrome.documentation}
            </Link>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-muted lg:flex">
            <Link href="/" className="transition-colors hover:text-ink">
              {t.docs.chrome.home}
            </Link>
            <Link href="/#features" className="transition-colors hover:text-ink">
              {t.docs.chrome.features}
            </Link>
            <Link href="/#agents" className="transition-colors hover:text-ink">
              {t.docs.chrome.agents}
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link
              href="/login"
              className="hidden rounded-lg border border-stroke bg-surface-elevated px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-brand-50 sm:inline-flex"
            >
              Log in
            </Link>
            <Link href="/sign-up">
              <Button className="rounded-xl px-5">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex w-full max-w-7xl gap-10 px-6 py-10 lg:py-14">
        <aside className="sticky top-24 hidden h-[calc(100vh-7rem)] w-60 shrink-0 overflow-y-auto pb-8 lg:block">
          <DocsSidebar />
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-6 lg:hidden">
            <MobileDocsNav />
          </div>
          <article className="docs-prose">{children}</article>
        </main>

        <aside className="sticky top-24 hidden h-[calc(100vh-7rem)] w-56 shrink-0 overflow-y-auto pb-8 xl:block">
          <DocsTOC />
        </aside>
      </div>
    </div>
  );
}
