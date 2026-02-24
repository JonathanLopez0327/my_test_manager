"use client";

import { Modal } from "./Modal";
import { Button } from "./Button";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

type ConfirmationDialogProps = {
    open: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "info";
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
    isConfirming?: boolean;
};

export function ConfirmationDialog({
    open,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "danger",
    onConfirm,
    onCancel,
    isConfirming = false,
}: ConfirmationDialogProps) {
    return (
        <Modal open={open} onClose={onCancel} size="md">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
                    <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${variant === "danger"
                            ? "bg-danger-100 text-danger-600 dark:bg-danger-500/15 dark:text-danger-500"
                            : "bg-warning-500/15 text-warning-500"
                            }`}
                    >
                        <ExclamationTriangleIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-ink">{title}</h3>
                        <p className="text-sm text-ink-muted">{description}</p>
                    </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="quiet" onClick={onCancel} disabled={isConfirming}>
                        {cancelText}
                    </Button>
                    <Button
                        variant={variant === "danger" ? "critical" : "primary"}
                        onClick={onConfirm}
                        disabled={isConfirming}
                    >
                        {isConfirming ? "Processing..." : confirmText}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
