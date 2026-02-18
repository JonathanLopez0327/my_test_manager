"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "./Button";

type ModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  size = "2xl",
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
        className="absolute inset-0 bg-[#1b1f27]/45 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        className={`relative flex w-full ${maxWidthClass} max-h-[calc(100vh-4rem)] flex-col rounded-2xl border border-stroke bg-surface-elevated p-6 shadow-soft`}
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
