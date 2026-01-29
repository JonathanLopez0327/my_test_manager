"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import type { ProjectPayload, ProjectRecord } from "./types";
import { projectSchema, type ProjectFormInput } from "@/lib/schemas/project";

type ProjectFormSheetProps = {
    open: boolean;
    project: ProjectRecord | null;
    onClose: () => void;
    onSave: (payload: ProjectPayload, projectId?: string) => Promise<void>;
};

export function ProjectFormSheet({
    open,
    project,
    onClose,
    onSave,
}: ProjectFormSheetProps) {
    const [globalError, setGlobalError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<ProjectFormInput>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            key: "",
            name: "",
            description: "",
            isActive: true,
        },
    });

    const title = useMemo(
        () => (project ? "Editar proyecto" : "Nuevo proyecto"),
        [project],
    );

    useEffect(() => {
        if (open) {
            if (project) {
                reset({
                    key: project.key,
                    name: project.name,
                    description: project.description ?? "",
                    isActive: project.isActive,
                });
            } else {
                reset({
                    key: "",
                    name: "",
                    description: "",
                    isActive: true,
                });
            }
            setGlobalError(null);
        }
    }, [project, open, reset]);

    const onSubmit = async (data: ProjectFormInput) => {
        setGlobalError(null);
        try {
            await onSave(
                { ...data, isActive: data.isActive ?? true },
                project?.id,
            );
            onClose();
        } catch (submitError) {
            setGlobalError(
                submitError instanceof Error
                    ? submitError.message
                    : "No se pudo guardar el proyecto.",
            );
        }
    };

    return (
        <Sheet
            open={open}
            title={title}
            description="Completa los datos básicos del proyecto. El key debe ser único."
            onClose={onClose}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
                <label className="text-sm font-semibold text-ink">
                    Key
                    <Input
                        {...register("key")}
                        placeholder="QA-CORE"
                        maxLength={20}
                        className="mt-2"
                        onChange={(e) => {
                            setValue("key", e.target.value.toUpperCase());
                        }}
                    />
                    {errors.key && (
                        <p className="mt-1 text-xs text-danger-500">{errors.key.message}</p>
                    )}
                </label>
                <label className="text-sm font-semibold text-ink">
                    Nombre del proyecto
                    <Input
                        {...register("name")}
                        placeholder="Payments Core"
                        className="mt-2"
                    />
                    {errors.name && (
                        <p className="mt-1 text-xs text-danger-500">{errors.name.message}</p>
                    )}
                </label>
                <label className="text-sm font-semibold text-ink">
                    Descripción
                    <Input
                        {...register("description")}
                        placeholder="Opcional"
                        className="mt-2"
                    />
                    {errors.description && (
                        <p className="mt-1 text-xs text-danger-500">
                            {errors.description.message}
                        </p>
                    )}
                </label>
                <label className="flex items-center gap-3 text-sm font-semibold text-ink">
                    <input
                        type="checkbox"
                        {...register("isActive")}
                        className="h-5 w-5 rounded border-stroke text-brand-600 focus:ring-brand-500"
                    />
                    Proyecto activo
                </label>

                {globalError && (
                    <p className="rounded-lg bg-danger-500/10 px-4 py-2 text-sm text-danger-500">
                        {globalError}
                    </p>
                )}

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <Button variant="ghost" onClick={onClose} type="button">
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Guardando..." : "Guardar proyecto"}
                    </Button>
                </div>
            </form>
        </Sheet>
    );
}
