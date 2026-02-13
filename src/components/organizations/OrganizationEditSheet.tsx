"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  organizationUpdateSchema,
  type OrganizationUpdateFormInput,
} from "@/lib/schemas/organization";
import type { OrganizationDetail, OrganizationUpdatePayload } from "./types";

type OrganizationEditSheetProps = {
  open: boolean;
  org: OrganizationDetail | null;
  onClose: () => void;
  onSave: (payload: OrganizationUpdatePayload) => Promise<void>;
};

export function OrganizationEditSheet({
  open,
  org,
  onClose,
  onSave,
}: OrganizationEditSheetProps) {
  const [globalError, setGlobalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationUpdateFormInput>({
    resolver: zodResolver(organizationUpdateSchema),
    defaultValues: { name: "", slug: "", isActive: true },
  });

  useEffect(() => {
    if (open && org) {
      reset({
        name: org.name,
        slug: org.slug,
        isActive: org.isActive,
      });
      setGlobalError(null);
    }
  }, [open, org, reset]);

  const onSubmit = async (data: OrganizationUpdateFormInput) => {
    setGlobalError(null);
    try {
      await onSave({
        name: data.name,
        slug: data.slug,
        isActive: data.isActive,
      });
      onClose();
    } catch (err) {
      setGlobalError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la organización.",
      );
    }
  };

  return (
    <Sheet
      open={open}
      title="Editar organización"
      description="Actualiza los datos de la organización."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <label className="text-sm font-semibold text-ink">
          Slug
          <Input
            {...register("slug")}
            placeholder="mi-empresa"
            maxLength={50}
            className="mt-2"
            onChange={(e) => {
              setValue("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
          />
          {errors.slug && (
            <p className="mt-1 text-xs text-danger-500">{errors.slug.message}</p>
          )}
        </label>
        <label className="text-sm font-semibold text-ink">
          Nombre
          <Input
            {...register("name")}
            placeholder="Mi Empresa"
            className="mt-2"
          />
          {errors.name && (
            <p className="mt-1 text-xs text-danger-500">{errors.name.message}</p>
          )}
        </label>
        <label className="flex items-center gap-3 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            {...register("isActive")}
            className="h-5 w-5 rounded border-stroke text-brand-600 focus:ring-brand-500"
          />
          Organización activa
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
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
