"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  organizationCreateSchema,
  type OrganizationCreateFormInput,
} from "@/lib/schemas/organization";
import type { OrganizationRecord } from "./types";

type OrganizationCreateSheetProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (org: OrganizationRecord) => void;
};

export function OrganizationCreateSheet({
  open,
  onClose,
  onCreated,
}: OrganizationCreateSheetProps) {
  const [globalError, setGlobalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationCreateFormInput>({
    resolver: zodResolver(organizationCreateSchema),
    defaultValues: { slug: "", name: "" },
  });

  useEffect(() => {
    if (open) {
      reset({ slug: "", name: "" });
      setGlobalError(null);
    }
  }, [open, reset]);

  const onSubmit = async (data: OrganizationCreateFormInput) => {
    setGlobalError(null);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || "No se pudo crear la organización.");
      }
      onCreated(body as OrganizationRecord);
      onClose();
    } catch (err) {
      setGlobalError(
        err instanceof Error ? err.message : "No se pudo crear la organización.",
      );
    }
  };

  return (
    <Sheet
      open={open}
      title="Nueva organización"
      description="Crea una nueva organización. El slug debe ser único."
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
            {isSubmitting ? "Creando..." : "Crear organización"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
