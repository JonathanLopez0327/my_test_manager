"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

type ModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div className="relative w-full max-w-2xl rounded-xl border border-stroke bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            {title ? (
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-ink-muted">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-stroke px-3 py-1 text-xs font-semibold text-ink-muted hover:text-ink"
          >
            Close
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
