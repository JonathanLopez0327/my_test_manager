"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "./Button";

type SheetProps = {
    open: boolean;
    title?: string;
    description?: string;
    onClose: () => void;
    children: ReactNode;
    width?: "md" | "lg" | "xl" | "2xl" | "full";
};

const widths = {
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    full: "max-w-[calc(100vw-2rem)]",
};

export function Sheet({
    open,
    title,
    description,
    onClose,
    children,
    width = "xl",
}: SheetProps) {
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = previousOverflow;
        }
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div
                className="absolute inset-0 bg-[#1b1f27]/45 backdrop-blur-[1px]"
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                className={`relative z-50 flex h-full w-full flex-col border-l border-stroke bg-surface-elevated shadow-soft ${widths[width]}`}
            >
                <div className="flex items-start justify-between border-b border-stroke px-6 py-5">
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

                <div className="flex-1 overflow-y-auto p-6">{children}</div>
            </div>
        </div>
    );
}
