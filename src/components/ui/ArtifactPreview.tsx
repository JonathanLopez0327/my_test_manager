"use client";

import { useEffect } from "react";
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
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (open) {
            document.body.style.overflow = "hidden";
            window.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, onClose]);

    if (!open || !artifact) return null;

    const { url, mimeType, type, name } = artifact;

    const isImage =
        mimeType?.startsWith("image/") || type === "screenshot" || url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i);
    const isVideo =
        mimeType?.startsWith("video/") || type === "video" || url.match(/\.(mp4|webm|mov)$/i);
    const isPdf = mimeType === "application/pdf" || url.match(/\.pdf$/i);
    const isHtml = mimeType === "text/html" || url.match(/\.html?$/i);
    const isText = mimeType === "text/plain" || type === "log" || url.match(/\.(txt|log|json|xml|csv)$/i);

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
                    autoPlay
                />
            );
        }
        if (isPdf || isHtml || isText) {
            return (
                <iframe
                    src={url}
                    title={name || "Artifact Preview"}
                    className="h-[85vh] w-full rounded shadow-lg bg-white"
                />
            );
        }
        return (
            <div className="flex flex-col items-center justify-center p-10 text-white">
                <p className="text-lg font-semibold">Previsualización no disponible</p>
                <p className="mt-2 text-sm text-gray-400">
                    Este tipo de archivo no se puede visualizar directamente.
                </p>
                <a
                    href={url}
                    download={name || "artifact"}
                    className="mt-6 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
                >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Descargar archivo
                </a>
            </div>
        );
    };

    const portalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200">
            {/* Header / Controls */}
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
                    className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
                    title="Cerrar (Esc)"
                >
                    <XMarkIcon className="h-6 w-6" />
                </button>
            </div>

            <div className="absolute top-4 left-4 max-w-[70vw] truncate">
                <h3 className="text-lg font-medium text-white drop-shadow-md">
                    {name || "Visualizador de Artefactos"}
                </h3>
            </div>

            {/* Content Container */}
            <div className="relative flex h-full w-full max-w-6xl items-center justify-center overflow-auto">
                {renderContent()}
            </div>
        </div>
    );

    // Use portal to ensure it renders on top of everything including Sheets/Modals
    return createPortal(portalContent, document.body);
}
