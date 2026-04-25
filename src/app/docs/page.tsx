import Link from "next/link";
import type { Metadata } from "next";
import { getDocNav } from "./nav-config";
import { DocPageHeader } from "@/components/docs/DocPageHeader";
import { resolveLocale } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/messages";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "Get started with Test Manager — guides for QA workflows, the AI workspace, and building agents.",
};

export default async function DocsOverviewPage() {
  const locale = await resolveLocale();
  const t = getMessages(locale);
  const docNav = getDocNav(t);

  return (
    <>
      <DocPageHeader
        eyebrow={t.docs.overview.eyebrow}
        title={t.docs.overview.title}
        lead={t.docs.overview.lead}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        {docNav.map((section) => (
          <div
            key={section.title}
            className="rounded-2xl border border-stroke bg-surface-elevated p-5 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
              {section.title}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-medium text-ink hover:text-brand-700"
                  >
                    {link.label}
                  </Link>
                  {link.description ? (
                    <p className="mt-0.5 text-xs leading-5 text-ink-muted">
                      {link.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
