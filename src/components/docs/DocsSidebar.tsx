"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDocNav } from "@/app/docs/nav-config";
import { useT } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

export function DocsSidebar() {
  const pathname = usePathname();
  const t = useT();
  const docNav = getDocNav(t);

  return (
    <nav aria-label="Docs navigation" className="text-sm">
      <div className="space-y-7">
        {docNav.map((section) => (
          <div key={section.title}>
            <p className="px-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
              {section.title}
            </p>
            <ul className="mt-2 space-y-0.5">
              {section.links.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "block rounded-lg px-2.5 py-1.5 transition-colors",
                        isActive
                          ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/10"
                          : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
