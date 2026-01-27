"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../ui/Card";
import { Pagination } from "../ui/Pagination";
import { ProjectsHeader } from "./ProjectsHeader";
import { ProjectFormModal } from "./ProjectFormModal";
import { ProjectsTable } from "./ProjectsTable";
import type { ProjectPayload, ProjectRecord, ProjectsResponse } from "./types";

const DEFAULT_PAGE_SIZE = 10;

export function ProjectsPage() {
  const [items, setItems] = useState<ProjectRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRecord | null>(null);

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
    setEditing(null);
    setModalOpen(true);
  };

  const handleEdit = (project: ProjectRecord) => {
    setEditing(project);
    setModalOpen(true);
  };

  const handleDelete = async (project: ProjectRecord) => {
    const confirmed = window.confirm(
      `¿Eliminar el proyecto "${project.name}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "No se pudo eliminar el proyecto.");
      }
      await fetchProjects();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el proyecto.",
      );
    } finally {
      setLoading(false);
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
      <Card className="p-6">
        <ProjectsHeader
          query={query}
          onQueryChange={setQuery}
          onCreate={handleCreate}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Listado de proyectos</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-soft">
            {loading ? "Actualizando..." : `Total: ${total}`}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          <ProjectsTable
            items={items}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>

        <div className="mt-6">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </div>
      </Card>

      <ProjectFormModal
        open={modalOpen}
        project={editing}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
