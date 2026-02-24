"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Pagination } from "../ui/Pagination";
import { ProjectsHeader } from "./ProjectsHeader";
import { ProjectFormSheet } from "./ProjectFormSheet";
import { ProjectsTable } from "./ProjectsTable";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { DataWorkspace } from "../ui/DataWorkspace";
import { Button } from "../ui/Button";
import type { ProjectPayload, ProjectRecord, ProjectsResponse } from "./types";

const DEFAULT_PAGE_SIZE = 10;

export function ProjectsPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<ProjectRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    id: string | null;
    name: string;
    isConfirming: boolean;
  }>({ open: false, id: null, name: "", isConfirming: false });
  const [editing, setEditing] = useState<ProjectRecord | null>(null);

  const isReadOnlyGlobal = useMemo(
    () =>
      session?.user?.globalRoles?.some(
        (role) => role === "support" || role === "auditor",
      ) ?? false,
    [session?.user?.globalRoles],
  );

  const canManage = !isReadOnlyGlobal;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        query,
      });
      const response = await fetch(`/api/projects?${params.toString()}`);
      const data = (await response.json()) as ProjectsResponse & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los proyectos.");
      }
      setItems(data.items);
      setTotal(data.total);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron cargar los proyectos.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleCreate = () => {
    if (!canManage) return;
    setEditing(null);
    setModalOpen(true);
  };

  const handleEdit = (project: ProjectRecord) => {
    if (!canManage) return;
    setEditing(project);
    setModalOpen(true);
  };

  const handleDelete = (project: ProjectRecord) => {
    if (!canManage) return;
    setDeleteConfirmation({
      open: true,
      id: project.id,
      name: project.name,
      isConfirming: false,
    });
  };

  const handleConfirmDelete = async () => {
    const { id } = deleteConfirmation;
    if (!id) return;

    setDeleteConfirmation((prev) => ({ ...prev, isConfirming: true }));
    setError(null);
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "No se pudo eliminar el proyecto.");
      }
      await fetchProjects();
      setDeleteConfirmation({ open: false, id: null, name: "", isConfirming: false });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el proyecto.",
      );
      setDeleteConfirmation((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const handleSave = async (payload: ProjectPayload, projectId?: string) => {
    const method = projectId ? "PUT" : "POST";
    const endpoint = projectId ? `/api/projects/${projectId}` : "/api/projects";
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(data.message || "No se pudo guardar el proyecto.");
    }
    await fetchProjects();
  };

  return (
    <div className="space-y-6">
      <DataWorkspace
        eyebrow="Workspace de datos"
        title="Proyectos"
        subtitle="Administra el inventario de proyectos y su estado operativo."
        toolbar={
          <ProjectsHeader
            query={query}
            onQueryChange={setQuery}
            onCreate={handleCreate}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            canCreate={canManage}
          />
        }
        status={
          <>
            <p className="text-sm font-semibold text-ink">Listado de proyectos</p>
            <div className="flex items-center gap-3 text-xs font-medium text-ink-soft">
              {loading ? "Actualizando..." : `Total: ${total}`}
            </div>
          </>
        }
        feedback={
          error ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-600">
              <span>{error}</span>
              <Button size="xs" variant="critical" onClick={fetchProjects}>
                Reintentar
              </Button>
            </div>
          ) : null
        }
        content={
          <ProjectsTable
            items={items}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            canManage={canManage}
          />
        }
        footer={
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        }
      />

      {canManage ? (
        <ProjectFormSheet
          open={modalOpen}
          project={editing}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />

      ) : null}

      <ConfirmationDialog
        open={deleteConfirmation.open}
        title={`¿Eliminar proyecto "${deleteConfirmation.name}"?`}
        description="Esta acción eliminará el proyecto permanentemente. No se puede deshacer."
        confirmText="Eliminar"
        onConfirm={handleConfirmDelete}
        onCancel={() =>
          setDeleteConfirmation({
            open: false,
            id: null,
            name: "",
            isConfirming: false,
          })
        }
        isConfirming={deleteConfirmation.isConfirming}
      />
    </div>
  );
}
