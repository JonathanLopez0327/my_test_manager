"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";

export function LanguageToggle() {
  const { locale, messages, setLocale, isPending } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold uppercase text-ink-muted transition-colors duration-200 hover:bg-surface-muted hover:text-ink disabled:opacity-60"
        aria-label={messages.topbar.language}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isPending}
      >
        {locale}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <ul
            role="listbox"
            aria-label={messages.topbar.language}
            className="absolute right-0 z-50 mt-1.5 w-40 overflow-hidden rounded-lg border border-stroke bg-surface-elevated p-1.5 shadow-soft-sm dark:bg-surface-muted"
          >
            {SUPPORTED_LOCALES.map((code) => {
              const isActive = code === locale;
              return (
                <li key={code} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    onClick={() => {
                      setLocale(code as Locale);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-brand-50 font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
                        : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                    }`}
                  >
                    <span>{messages.languages[code]}</span>
                    <span className="text-xs uppercase opacity-60">{code}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
