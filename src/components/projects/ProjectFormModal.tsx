"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import type { ProjectPayload, ProjectRecord } from "./types";

type ProjectFormModalProps = {
  open: boolean;
  project: ProjectRecord | null;
  onClose: () => void;
  onSave: (payload: ProjectPayload, projectId?: string) => Promise<void>;
};

const emptyForm: ProjectPayload = {
  key: "",
  name: "",
  description: "",
  isActive: true,
};

export function ProjectFormModal({
  open,
  project,
  onClose,
  onSave,
}: ProjectFormModalProps) {
  const [form, setForm] = useState<ProjectPayload>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (project ? "Editar proyecto" : "Nuevo proyecto"),
    [project],
  );

  useEffect(() => {
    if (project) {
      setForm({
        key: project.key,
        name: project.name,
        description: project.description ?? "",
        isActive: project.isActive,
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
  }, [project, open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSave(form, project?.id);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el proyecto.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      description="Completa los datos básicos del proyecto. El key debe ser único."
      onClose={onClose}
    >
      <div className="grid gap-4">
        <label className="text-sm font-semibold text-ink">
          Key
          <Input
            value={form.key}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                key: event.target.value.toUpperCase(),
              }))
            }
            placeholder="QA-CORE"
            maxLength={20}
            className="mt-2"
          />
        </label>
        <label className="text-sm font-semibold text-ink">
          Nombre del proyecto
          <Input
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="Payments Core"
            className="mt-2"
          />
        </label>
        <label className="text-sm font-semibold text-ink">
          Descripción
          <Input
            value={form.description ?? ""}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="Opcional"
            className="mt-2"
          />
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
          Proyecto activo
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
          <Button
            onClick={handleSubmit}
            disabled={submitting || !form.key.trim() || !form.name.trim()}
          >
            {submitting ? "Guardando..." : "Guardar proyecto"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
