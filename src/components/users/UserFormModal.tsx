"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import type { UserPayload } from "./types";

type ProjectOption = {
  id: string;
  key: string;
  name: string;
};

type UserFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (payload: UserPayload) => Promise<void>;
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

export function UserFormModal({
  open,
  onClose,
  onSave,
  projects,
}: UserFormModalProps) {
  const [form, setForm] = useState<UserPayload>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => "Nuevo usuario", []);

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...emptyForm,
        projectId: projects[0]?.id ?? "",
      }));
      setError(null);
    }
  }, [open, projects]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSave(form);
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
  const isValid =
    form.email.trim() &&
    form.password.trim() &&
    form.projectId.trim() &&
    form.password.length >= 8 &&
    hasProjects;

  return (
    <Modal
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
            placeholder="Mínimo 8 caracteres"
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
            {submitting ? "Creando..." : "Crear usuario"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
