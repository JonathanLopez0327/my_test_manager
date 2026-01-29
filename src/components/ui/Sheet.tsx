"use client";

import { Fragment, type ReactNode } from "react";
import { useEffect, useState } from "react";
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
    const [isVisible, setIsVisible] = useState(open);

    useEffect(() => {
        if (open) {
            setIsVisible(true);
            document.body.style.overflow = "hidden";
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300); // Wait for animation
            document.body.style.overflow = "";
            return () => clearTimeout(timer);
        }
    }, [open]);

    if (!isVisible && !open) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"
                    }`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className={`relative z-50 flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 transform ${widths[width]
                    } ${open ? "translate-x-0" : "translate-x-full"}`}
            >
                <div className="flex items-start justify-between border-b border-stroke px-6 py-4">
                    <div>
                        {title ? (
                            <h2 className="text-lg font-semibold text-ink">{title}</h2>
                        ) : null}
                        {description ? (
                            <p className="mt-1 text-sm text-ink-muted">{description}</p>
                        ) : null}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="!p-2 text-ink-muted hover:text-ink"
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
