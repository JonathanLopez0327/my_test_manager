"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import type { UserPayload, UserRecord, UserUpdatePayload } from "./types";

type ProjectOption = {
    id: string;
    key: string;
    name: string;
};

type UserFormSheetProps = {
    open: boolean;
    onClose: () => void;
    onSave: (
        payload: UserPayload | UserUpdatePayload,
        userId?: string,
    ) => Promise<void>;
    user?: UserRecord | null;
    projects: ProjectOption[];
};

const emptyForm: UserPayload = {
    email: "",
    fullName: "",
    password: "",
    isActive: true,
    projectId: "",
    projectRole: "viewer",
};

export function UserFormSheet({
    open,
    onClose,
    onSave,
    user,
    projects,
}: UserFormSheetProps) {
    const [form, setForm] = useState<UserPayload>(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const title = useMemo(
        () => (user ? "Editar usuario" : "Nuevo usuario"),
        [user],
    );

    useEffect(() => {
        if (!open) return;
        if (user) {
            const membership = user.memberships[0];
            setForm({
                email: user.email,
                fullName: user.fullName ?? "",
                password: "",
                isActive: user.isActive,
                projectId: membership?.projectId ?? projects[0]?.id ?? "",
                projectRole: membership?.role ?? "viewer",
            });
        } else {
            setForm({
                ...emptyForm,
                projectId: projects[0]?.id ?? "",
            });
        }
        setError(null);
    }, [open, projects, user]);

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            if (user) {
                const payload: UserUpdatePayload = {
                    fullName: form.fullName ?? null,
                    password: form.password || undefined,
                    isActive: form.isActive,
                    projectId: form.projectId,
                    projectRole: form.projectRole,
                };
                await onSave(payload, user.id);
            } else {
                await onSave(form);
            }
            onClose();
        } catch (submitError) {
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : "No se pudo crear el usuario.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    const hasProjects = projects.length > 0;
    const isValid = user
        ? Boolean(form.projectId.trim()) && hasProjects
        : form.email.trim() &&
        form.password.trim() &&
        form.projectId.trim() &&
        form.password.length >= 8 &&
        hasProjects;

    return (
        <Sheet
            open={open}
            title={title}
            description="Define el acceso del usuario y su proyecto principal."
            onClose={onClose}
        >
            <div className="grid gap-4">
                <label className="text-sm font-semibold text-ink">
                    Email
                    <Input
                        value={form.email}
                        onChange={(event) =>
                            setForm((prev) => ({
                                ...prev,
                                email: event.target.value,
                            }))
                        }
                        placeholder="user@empresa.com"
                        type="email"
                        className="mt-2"
                        disabled={Boolean(user)}
                    />
                </label>
                <label className="text-sm font-semibold text-ink">
                    Nombre
                    <Input
                        value={form.fullName ?? ""}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, fullName: event.target.value }))
                        }
                        placeholder="Nombre completo"
                        className="mt-2"
                    />
                </label>
                <label className="text-sm font-semibold text-ink">
                    Contraseña
                    <Input
                        value={form.password}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, password: event.target.value }))
                        }
                        type="password"
                        placeholder={
                            user ? "Dejar vacío para mantener" : "Mínimo 8 caracteres"
                        }
                        className="mt-2"
                    />
                </label>
                <label className="text-sm font-semibold text-ink">
                    Proyecto
                    <select
                        value={form.projectId}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, projectId: event.target.value }))
                        }
                        className="mt-2 h-10 w-full rounded-xl border border-stroke bg-white px-3 text-sm text-ink"
                        disabled={!hasProjects}
                    >
                        {projects.length ? (
                            projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.key} · {project.name}
                                </option>
                            ))
                        ) : (
                            <option value="">No hay proyectos disponibles</option>
                        )}
                    </select>
                </label>
                <label className="text-sm font-semibold text-ink">
                    Rol de proyecto
                    <select
                        value={form.projectRole}
                        onChange={(event) =>
                            setForm((prev) => ({
                                ...prev,
                                projectRole: event.target.value as UserPayload["projectRole"],
                            }))
                        }
                        className="mt-2 h-10 w-full rounded-xl border border-stroke bg-white px-3 text-sm text-ink"
                    >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                    </select>
                </label>
                <label className="flex items-center gap-3 text-sm font-semibold text-ink">
                    <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, isActive: event.target.checked }))
                        }
                        className="h-5 w-5 rounded border-stroke text-brand-600 focus:ring-brand-500"
                    />
                    Usuario activo
                </label>
                {error ? (
                    <p className="rounded-lg bg-danger-500/10 px-4 py-2 text-sm text-danger-500">
                        {error}
                    </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <Button variant="ghost" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || !isValid}>
                        {submitting
                            ? user
                                ? "Guardando..."
                                : "Creando..."
                            : user
                                ? "Guardar cambios"
                                : "Crear usuario"}
                    </Button>
                </div>
            </div>
        </Sheet>
    );
}
