"use client";

import Link from "next/link";
import { flattenDocLinks } from "@/app/docs/nav-config";
import { useT } from "@/lib/i18n/LocaleProvider";

export function Pager({ currentPath }: { currentPath: string }) {
  const t = useT();
  const links = flattenDocLinks(t);
  const idx = links.findIndex((link) => link.href === currentPath);
  if (idx === -1) return null;

  const prev = idx > 0 ? links[idx - 1] : null;
  const next = idx < links.length - 1 ? links[idx + 1] : null;

  return (
    <div className="mt-14 grid gap-4 border-t border-stroke pt-8 sm:grid-cols-2">
      {prev ? (
        <Link
          href={prev.href}
          className="group flex flex-col rounded-2xl border border-stroke bg-surface-elevated p-4 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_14px_32px_-22px_rgba(109,89,255,0.45)]"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-ink-soft">
            ← {t.docs.chrome.previous}
          </span>
          <span className="mt-1 text-sm font-semibold text-ink">{prev.label}</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group flex flex-col items-end rounded-2xl border border-stroke bg-surface-elevated p-4 text-right transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_14px_32px_-22px_rgba(109,89,255,0.45)] sm:col-start-2"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-ink-soft">
            {t.docs.chrome.next} →
          </span>
          <span className="mt-1 text-sm font-semibold text-ink">{next.label}</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}
