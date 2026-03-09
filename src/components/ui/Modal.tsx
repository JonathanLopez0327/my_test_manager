"use client";

import type { ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "./Button";

type ModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  closeOnEsc?: boolean;
  trapFocus?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  size = "2xl",
  closeOnEsc = false,
  trapFocus = false,
  initialFocusRef,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !initialFocusRef?.current) return;
    initialFocusRef.current.focus();
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open || (!closeOnEsc && !trapFocus)) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEsc) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !trapFocus) return;

      const container = dialogRef.current;
      if (!container) return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEsc, onClose, open, trapFocus]);

  if (!open) return null;

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className={`relative flex w-full ${maxWidthClass} max-h-[calc(100vh-4rem)] flex-col rounded-[10px] border border-stroke bg-surface-elevated p-6 shadow-3 dark:bg-surface-muted`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            {title ? (
              <h2 className="text-2xl font-semibold text-ink">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-ink-muted">{description}</p>
            ) : null}
          </div>
          <Button
            variant="quiet"
            size="xs"
            onClick={onClose}
            className="!h-8 !w-8 !p-0 text-ink-muted hover:text-ink"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>
        <div className="mt-6 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}

