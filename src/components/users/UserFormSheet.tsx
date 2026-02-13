"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import type { UserPayload, UserRecord, UserUpdatePayload } from "./types";

type OrganizationOption = {
    id: string;
    slug: string;
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
    organizations: OrganizationOption[];
};

const emptyForm: UserPayload = {
    email: "",
    fullName: "",
    password: "",
    isActive: true,
    memberships: [],
};

export function UserFormSheet({
    open,
    onClose,
    onSave,
    user,
    organizations,
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
            setForm({
                email: user.email,
                fullName: user.fullName ?? "",
                password: "",
                isActive: user.isActive,
                memberships: user.memberships.map((m) => ({
                    organizationId: m.organizationId,
                    role: m.role,
                })),
            });
        } else {
            setForm(emptyForm);
        }
        setError(null);
    }, [open, user]);

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            if (user) {
                const payload: UserUpdatePayload = {
                    fullName: form.fullName ?? null,
                    password: form.password || undefined,
                    isActive: form.isActive,
                    memberships: form.memberships,
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

    const handleAddMembership = () => {
        if (!organizations.length) return;
        const firstAvailable = organizations.find(
            (o) => !form.memberships.some((m) => m.organizationId === o.id),
        );
        if (firstAvailable) {
            setForm((prev) => ({
                ...prev,
                memberships: [
                    ...prev.memberships,
                    { organizationId: firstAvailable.id, role: "member" },
                ],
            }));
        }
    };

    const handleRemoveMembership = (index: number) => {
        setForm((prev) => ({
            ...prev,
            memberships: prev.memberships.filter((_, i) => i !== index),
        }));
    };

    const handleUpdateMembership = (
        index: number,
        field: "organizationId" | "role",
        value: string,
    ) => {
        setForm((prev) => {
            const newMemberships = [...prev.memberships];
            // @ts-ignore
            newMemberships[index] = { ...newMemberships[index], [field]: value };
            return { ...prev, memberships: newMemberships };
        });
    };

    const isValid = user
        ? Boolean(form.memberships.length)
        : form.email.trim() &&
        form.password.trim() &&
        form.memberships.length > 0 &&
        form.password.length >= 8;

    const availableOrganizations = (currentOrgId?: string) =>
        organizations.filter(
            (o) =>
                o.id === currentOrgId ||
                !form.memberships.some((m) => m.organizationId === o.id),
        );

    return (
        <Sheet
            open={open}
            title={title}
            description="Define el acceso del usuario a las organizaciones."
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

                <div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-ink">Organizaciones</span>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleAddMembership}
                            disabled={form.memberships.length >= organizations.length}
                        >
                            + Agregar
                        </Button>
                    </div>
                    <div className="mt-3 space-y-3">
                        {form.memberships.map((membership, index) => (
                            <div
                                key={index}
                                className="group relative flex flex-col gap-3 rounded-xl border border-stroke bg-gray-50/50 p-3 transition hover:border-brand-200 hover:bg-brand-50/30 sm:flex-row sm:items-center"
                            >
                                <div className="flex-1 space-y-1">
                                    <div className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                                        Organización
                                    </div>
                                    <select
                                        value={membership.organizationId}
                                        onChange={(e) =>
                                            handleUpdateMembership(index, "organizationId", e.target.value)
                                        }
                                        className="h-9 w-full rounded-lg border border-stroke bg-white px-2.5 text-sm text-ink transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                    >
                                        {availableOrganizations(membership.organizationId).map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.slug} · {o.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-end gap-2 sm:w-1/3 sm:flex-col sm:items-stretch sm:gap-1">
                                    <div className="hidden text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:block">
                                        Rol
                                    </div>
                                    <select
                                        value={membership.role}
                                        onChange={(e) =>
                                            handleUpdateMembership(index, "role", e.target.value)
                                        }
                                        className="h-9 flex-1 rounded-lg border border-stroke bg-white px-2.5 text-sm text-ink transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                    >
                                        <option value="member">Member</option>
                                        <option value="admin">Admin</option>
                                        <option value="owner">Owner</option>
                                        <option value="billing">Billing</option>
                                    </select>
                                    <button
                                        onClick={() => handleRemoveMembership(index)}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-ink-muted transition hover:bg-danger-50 hover:text-danger-500 sm:absolute sm:-right-2 sm:-top-2 sm:h-6 sm:w-6 sm:rounded-full sm:bg-white sm:border-stroke sm:shadow-sm"
                                        aria-label="Quitar organización"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M18 6 6 18" />
                                            <path d="m6 6 12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {form.memberships.length === 0 && (
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stroke py-8 text-center">
                                <p className="text-sm text-ink-muted">
                                    Este usuario no tiene organizaciones asignadas.
                                </p>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleAddMembership}
                                    className="mt-2 text-brand-600 hover:text-brand-700"
                                    disabled={!organizations.length}
                                >
                                    Asignar organización
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

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
