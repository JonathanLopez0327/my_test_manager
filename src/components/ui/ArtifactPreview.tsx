"use client";

import { useEffect, useRef, useState } from "react";
import { XMarkIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { createPortal } from "react-dom";

type ArtifactPreviewProps = {
    open: boolean;
    onClose: () => void;
    artifact: {
        url: string;
        type: string;
        mimeType?: string | null;
        name?: string | null;
    } | null;
};

export function ArtifactPreview({
    open,
    onClose,
    artifact,
}: ArtifactPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const [textPreview, setTextPreview] = useState<string>("");
    const [textPreviewUrl, setTextPreviewUrl] = useState<string>("");
    const [textError, setTextError] = useState<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Tab" && containerRef.current) {
                const focusable = containerRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        if (open) {
            document.body.style.overflow = "hidden";
            window.addEventListener("keydown", handleKeyDown);
            closeButtonRef.current?.focus();
        }
        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, onClose]);

    const previewArtifact = artifact ?? {
        url: "",
        type: "other",
        mimeType: null,
        name: null,
    };

    const { url, mimeType, type, name } = previewArtifact;

    const isImage =
        mimeType?.startsWith("image/") || type === "screenshot" || url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i);
    const isVideo =
        mimeType?.startsWith("video/") || type === "video" || url.match(/\.(mp4|webm|mov)$/i);
    const isPdf = mimeType === "application/pdf" || url.match(/\.pdf$/i);
    const isHtml = mimeType?.includes("html") || type === "report" || url.match(/\.html?$/i);
    const isText =
        mimeType?.startsWith("text/") ||
        mimeType?.includes("json") ||
        type === "log" ||
        url.match(/\.(txt|log|json|xml|csv|md|yaml|yml)$/i);

    useEffect(() => {
        let active = true;
        if (!open || !artifact || !isText) return;

        fetch(url, { cache: "no-store" })
            .then(async (response) => {
                if (!response.ok) throw new Error("Unable to load text preview.");
                const text = await response.text();
                return text.slice(0, 200_000);
            })
            .then((text) => {
                if (!active) return;
                setTextPreviewUrl(url);
                setTextPreview(text);
                setTextError(null);
            })
            .catch((fetchError) => {
                if (!active) return;
                setTextPreviewUrl(url);
                setTextPreview("");
                setTextError(
                    fetchError instanceof Error
                        ? fetchError.message
                        : "Unable to load text preview.",
                );
            });

        return () => {
            active = false;
        };
    }, [isText, open, url, artifact]);

    const isTextLoading = isText && textPreviewUrl !== url && !textError;

    const renderContent = () => {
        if (isImage) {
            return (
                <img
                    src={url}
                    alt={name || "Artifact"}
                    className="max-h-[85vh] max-w-full rounded shadow-lg object-contain"
                />
            );
        }
        if (isVideo) {
            return (
                <video
                    controls
                    src={url}
                    className="max-h-[85vh] max-w-full rounded shadow-lg"
                />
            );
        }
        if (isPdf) {
            return (
                <iframe
                    src={url}
                    title={name || "Artifact Preview"}
                    className="h-[85vh] w-full rounded shadow-lg bg-white"
                />
            );
        }
        if (isHtml) {
            return (
                <div className="flex h-[85vh] w-full flex-col items-center justify-center gap-3 rounded bg-surface p-6 text-center text-ink">
                    <p className="text-sm text-ink-muted">
                        HTML reports are opened in a new tab for safer navigation.
                    </p>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
                    >
                        Open report
                    </a>
                </div>
            );
        }
        if (isText) {
            return (
                <div className="h-[85vh] w-full overflow-auto rounded bg-surface p-4 text-left shadow-lg">
                    {isTextLoading ? (
                        <p className="text-sm text-ink-muted">Loading preview...</p>
                    ) : textError && textPreviewUrl === url ? (
                        <div className="space-y-2">
                            <p className="text-sm text-danger-500">{textError}</p>
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-brand-600 hover:underline"
                            >
                                Open file
                            </a>
                        </div>
                    ) : (
                        <pre className="whitespace-pre-wrap break-words font-mono text-xs text-ink">
                            {textPreview || "No preview content."}
                        </pre>
                    )}
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center p-10 text-white">
                <p className="text-lg font-semibold">Preview unavailable</p>
                <p className="mt-2 text-sm text-gray-400">
                    This artifact type cannot be rendered directly.
                </p>
                <a
                    href={url}
                    download={name || "artifact"}
                    className="mt-6 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
                >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Download file
                </a>
            </div>
        );
    };

    const portalContent = (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-label={name || "Artifact preview"}
            ref={containerRef}
        >
            <div className="absolute top-4 right-4 flex items-center gap-4">
                <a
                    href={url}
                    download={name || "artifact"}
                    className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
                    title="Descargar"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <ArrowDownTrayIcon className="h-6 w-6" />
                </a>
                <button
                    onClick={onClose}
                    ref={closeButtonRef}
                    className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
                    title="Close (Esc)"
                >
                    <XMarkIcon className="h-6 w-6" />
                </button>
            </div>

            <div className="absolute top-4 left-4 max-w-[70vw] truncate">
                <h3 className="text-lg font-medium text-white drop-shadow-md">
                    {name || "Artifact Preview"}
                </h3>
            </div>

            <div className="relative flex h-full w-full max-w-6xl items-center justify-center overflow-auto">
                {renderContent()}
            </div>
        </div>
    );

    if (!open || !artifact) return null;

    return createPortal(portalContent, document.body);
}
