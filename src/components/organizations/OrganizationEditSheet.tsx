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
  type OrganizationUpdateFormValues,
} from "@/lib/schemas/organization";
import type { OrganizationDetail, OrganizationUpdatePayload } from "./types";

type OrganizationEditSheetProps = {
  open: boolean;
  org: OrganizationDetail | null;
  onClose: () => void;
  onSave: (payload: OrganizationUpdatePayload) => Promise<void>;
  showQuotas?: boolean;
};

export function OrganizationEditSheet({
  open,
  org,
  onClose,
  onSave,
  showQuotas = false,
}: OrganizationEditSheetProps) {
  const [globalError, setGlobalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationUpdateFormInput, unknown, OrganizationUpdateFormValues>({
    resolver: zodResolver(organizationUpdateSchema),
    defaultValues: { name: "", slug: "", isActive: true, maxProjects: 0, maxMembers: 0, maxTestCases: 0, maxTestRuns: 0, betaExpiresAt: "" },
  });

  useEffect(() => {
    if (open && org) {
      reset({
        name: org.name,
        slug: org.slug,
        isActive: org.isActive,
        maxProjects: org.maxProjects,
        maxMembers: org.maxMembers,
        maxTestCases: org.maxTestCases,
        maxTestRuns: org.maxTestRuns,
        betaExpiresAt: org.betaExpiresAt ? org.betaExpiresAt.slice(0, 10) : "",
      });
    }
  }, [open, org, reset]);

  const onSubmit = async (data: OrganizationUpdateFormValues) => {
    setGlobalError(null);
    try {
      const payload: OrganizationUpdatePayload = {
        name: data.name,
        slug: data.slug,
        isActive: data.isActive,
      };
      if (showQuotas) {
        payload.maxProjects = data.maxProjects;
        payload.maxMembers = data.maxMembers;
        payload.maxTestCases = data.maxTestCases;
        payload.maxTestRuns = data.maxTestRuns;
        payload.betaExpiresAt = data.betaExpiresAt
          ? new Date(data.betaExpiresAt).toISOString()
          : null;
      }
      await onSave(payload);
      onClose();
    } catch (err) {
      setGlobalError(
        err instanceof Error
          ? err.message
          : "Could not update the organization.",
      );
    }
  };

  return (
    <Sheet
      open={open}
      title="Edit organization"
      description="Update organization details."
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
          Name
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
          Organization activa
        </label>

        {showQuotas && (
          <div className="grid gap-3 rounded-lg border border-stroke p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Quotas</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-ink">
                Max Projects
                <Input
                  type="number"
                  min={0}
                  {...register("maxProjects")}
                  className="mt-2"
                />
                {errors.maxProjects && (
                  <p className="mt-1 text-xs text-danger-500">{errors.maxProjects.message}</p>
                )}
              </label>
              <label className="text-sm font-semibold text-ink">
                Max Members
                <Input
                  type="number"
                  min={0}
                  {...register("maxMembers")}
                  className="mt-2"
                />
                {errors.maxMembers && (
                  <p className="mt-1 text-xs text-danger-500">{errors.maxMembers.message}</p>
                )}
              </label>
              <label className="text-sm font-semibold text-ink">
                Max Test Cases
                <Input
                  type="number"
                  min={0}
                  {...register("maxTestCases")}
                  className="mt-2"
                />
                {errors.maxTestCases && (
                  <p className="mt-1 text-xs text-danger-500">{errors.maxTestCases.message}</p>
                )}
              </label>
              <label className="text-sm font-semibold text-ink">
                Max Test Runs
                <Input
                  type="number"
                  min={0}
                  {...register("maxTestRuns")}
                  className="mt-2"
                />
                {errors.maxTestRuns && (
                  <p className="mt-1 text-xs text-danger-500">{errors.maxTestRuns.message}</p>
                )}
              </label>
            </div>
            <label className="col-span-2 text-sm font-semibold text-ink">
              Beta Expires
              <Input
                type="date"
                {...register("betaExpiresAt")}
                className="mt-2"
              />
              <p className="mt-1 text-xs text-ink-muted">Leave empty for no expiration.</p>
            </label>
          </div>
        )}

        {globalError && (
          <p className="rounded-lg bg-danger-500/10 px-4 py-2 text-sm text-danger-500">
            {globalError}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}


