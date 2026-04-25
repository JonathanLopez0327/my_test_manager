"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleProvider";
import { DocsSidebar } from "./DocsSidebar";

export function MobileDocsNav() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-surface-elevated px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-brand-300 hover:bg-brand-50/30"
        aria-expanded={open}
        aria-controls="mobile-docs-nav"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M2 4h12M2 8h12M2 12h12"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        {t.docs.chrome.browseDocs}
      </button>

      {open ? (
        <div
          id="mobile-docs-nav"
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close docs navigation"
            className="flex-1 bg-ink/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="flex w-72 max-w-[80%] flex-col border-l border-stroke bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-stroke px-4 py-3">
              <p className="text-sm font-semibold text-ink">{t.docs.chrome.documentation}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                aria-label="Close"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <DocsSidebar />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
