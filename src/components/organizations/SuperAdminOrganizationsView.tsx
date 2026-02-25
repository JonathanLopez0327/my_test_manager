"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { IconEdit, IconPlus } from "../icons";
import { SortableHeaderCell } from "../ui/SortableHeaderCell";
import { OrganizationEditSheet } from "./OrganizationEditSheet";
import { OrganizationCreateSheet } from "./OrganizationCreateSheet";
import type {
  OrganizationRecord,
  OrganizationUpdatePayload,
  OrganizationsResponse,
  OrganizationSortBy,
  SortDir,
} from "./types";
import { nextSort } from "@/lib/sorting";

async function safeJson(res: Response): Promise<{ message?: string } & Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: `Error inesperado (HTTP ${res.status})` };
  }
}

export function SuperAdminOrganizationsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [orgs, setOrgs] = useState<OrganizationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit sheet
  const [editOrg, setEditOrg] = useState<OrganizationRecord | null>(null);
  const [editOrgOpen, setEditOrgOpen] = useState(false);

  // Create sheet
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const sortBy = (searchParams.get("sortBy") as OrganizationSortBy | null) ?? null;
  const sortDir = (searchParams.get("sortDir") as SortDir | null) ?? null;

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sortBy && sortDir) {
        params.set("sortBy", sortBy);
        params.set("sortDir", sortDir);
      }
      const res = await fetch(`/api/organizations${params.toString() ? `?${params.toString()}` : ""}`);
      if (!res.ok) throw new Error("No se pudieron cargar las organizaciones.");
      const data = (await res.json()) as OrganizationsResponse;
      setOrgs(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortDir]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const handleToggleActive = async (org: OrganizationRecord) => {
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${org.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !org.isActive }),
      });
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.message || "No se pudo actualizar la organización.");
      }
      await fetchOrgs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar.");
    }
  };

  const handleEditClick = (org: OrganizationRecord) => {
    setEditOrg(org);
    setEditOrgOpen(true);
  };

  const handleSaveOrg = async (payload: OrganizationUpdatePayload) => {
    if (!editOrg) return;
    const res = await fetch(`/api/organizations/${editOrg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await safeJson(res);
      throw new Error(data.message || "No se pudo actualizar la organización.");
    }
    await fetchOrgs();
  };

  const handleOrgCreated = async () => {
    await fetchOrgs();
  };

  const handleSort = (column: OrganizationSortBy) => {
    const next = nextSort<OrganizationSortBy>(sortBy, sortDir, column);
    const params = new URLSearchParams(searchParams.toString());
    if (!next) {
      params.delete("sortBy");
      params.delete("sortDir");
    } else {
      params.set("sortBy", next.sortBy);
      params.set("sortDir", next.sortDir);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Organizaciones</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Gestiona todas las organizaciones del sistema.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOrgOpen(true)}>
          <IconPlus className="h-4 w-4" />
          Nueva organizaci&oacute;n
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="flex items-center justify-center p-10">
          <span className="h-10 w-10 animate-pulse rounded-full bg-brand-100" />
          <span className="ml-3 text-sm text-ink-muted">Cargando...</span>
        </Card>
      ) : orgs.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-ink-muted">
            No hay organizaciones registradas.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-surface-elevated dark:bg-surface-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-stroke">
                <tr className="bg-surface-muted/50 text-ink-muted">
                  <SortableHeaderCell
                    label="Nombre"
                    sortKey="name"
                    activeSortBy={sortBy}
                    activeSortDir={sortDir}
                    onSort={handleSort}
                    className="px-4 py-3 font-semibold text-ink-muted"
                  />
                  <SortableHeaderCell
                    label="Slug"
                    sortKey="slug"
                    activeSortBy={sortBy}
                    activeSortDir={sortDir}
                    onSort={handleSort}
                    className="px-4 py-3 font-semibold text-ink-muted"
                  />
                  <SortableHeaderCell
                    label="Miembros"
                    sortKey="members"
                    activeSortBy={sortBy}
                    activeSortDir={sortDir}
                    onSort={handleSort}
                    className="px-4 py-3 font-semibold text-ink-muted text-center"
                  />
                  <SortableHeaderCell
                    label="Proyectos"
                    sortKey="projects"
                    activeSortBy={sortBy}
                    activeSortDir={sortDir}
                    onSort={handleSort}
                    className="px-4 py-3 font-semibold text-ink-muted text-center"
                  />
                  <SortableHeaderCell
                    label="Estado"
                    sortKey="isActive"
                    activeSortBy={sortBy}
                    activeSortDir={sortDir}
                    onSort={handleSort}
                    className="px-4 py-3 font-semibold text-ink-muted text-center"
                  />
                  <th className="px-4 py-3 font-semibold text-ink-muted text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr
                    key={org.id}
                    className="border-b border-stroke/50 transition hover:bg-surface-muted/30"
                  >
                    <td className="px-4 py-3 font-medium text-ink">{org.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{org.slug}</td>
                    <td className="px-4 py-3 text-center text-ink-muted">
                      {org._count.members}
                    </td>
                    <td className="px-4 py-3 text-center text-ink-muted">
                      {org._count.projects}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge tone={org.isActive ? "success" : "danger"}>
                        {org.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEditClick(org)}
                        >
                          <IconEdit className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          variant={org.isActive ? "danger" : "secondary"}
                          size="sm"
                          onClick={() => handleToggleActive(org)}
                        >
                          {org.isActive ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <OrganizationEditSheet
        open={editOrgOpen}
        org={editOrg ? { ...editOrg, createdBy: null } : null}
        onClose={() => {
          setEditOrgOpen(false);
          setEditOrg(null);
        }}
        onSave={handleSaveOrg}
      />

      <OrganizationCreateSheet
        open={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
        onCreated={handleOrgCreated}
      />
    </div>
  );
}
