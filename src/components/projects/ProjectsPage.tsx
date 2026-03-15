"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "../ui/Pagination";
import { ProjectsHeader } from "./ProjectsHeader";
import { ProjectFormSheet } from "./ProjectFormSheet";
import { ProjectsTable } from "./ProjectsTable";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { DataWorkspace } from "../ui/DataWorkspace";
import { Button } from "../ui/Button";
import type {
  ProjectPayload,
  ProjectRecord,
  ProjectsResponse,
  ProjectSortBy,
  SortDir,
} from "./types";
import { nextSort } from "@/lib/sorting";

const DEFAULT_PAGE_SIZE = 10;

export function ProjectsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    loadingCounts: boolean;
    hasRelated: boolean | null;
    counts: Record<string, number> | null;
    countsError: string | null;
  }>({ open: false, id: null, name: "", isConfirming: false, loadingCounts: false, hasRelated: null, counts: null, countsError: null });
  const [editing, setEditing] = useState<ProjectRecord | null>(null);

  const isReadOnlyGlobal = useMemo(
    () =>
      session?.user?.globalRoles?.some(
        (role) => role === "support" || role === "auditor",
      ) ?? false,
    [session?.user?.globalRoles],
  );

  const canManage = !isReadOnlyGlobal;
  const sortBy = (searchParams.get("sortBy") as ProjectSortBy | null) ?? null;
  const sortDir = (searchParams.get("sortDir") as SortDir | null) ?? null;

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
      if (sortBy && sortDir) {
        params.set("sortBy", sortBy);
        params.set("sortDir", sortDir);
      }
      const response = await fetch(`/api/projects?${params.toString()}`);
      const data = (await response.json()) as ProjectsResponse & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "Could not load projects.");
      }
      setItems(data.items);
      setTotal(data.total);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load projects.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, sortBy, sortDir]);

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

  const handleDelete = async (project: ProjectRecord) => {
    if (!canManage) return;
    setDeleteConfirmation({
      open: true,
      id: project.id,
      name: project.name,
      isConfirming: false,
      loadingCounts: true,
      hasRelated: null,
      counts: null,
      countsError: null,
    });
    try {
      const res = await fetch(`/api/projects/${project.id}/related-counts`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not load related counts.");
      setDeleteConfirmation((prev) => ({
        ...prev,
        loadingCounts: false,
        hasRelated: data.hasRelated,
        counts: data.counts,
      }));
    } catch (err) {
      setDeleteConfirmation((prev) => ({
        ...prev,
        loadingCounts: false,
        countsError: err instanceof Error ? err.message : "Could not load related counts.",
      }));
    }
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
        throw new Error(data.message || "Could not delete project.");
      }
      await fetchProjects();
      setDeleteConfirmation({ open: false, id: null, name: "", isConfirming: false, loadingCounts: false, hasRelated: null, counts: null, countsError: null });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete project.",
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
      throw new Error(data.message || "Could not save project.");
    }
    await fetchProjects();
  };

  const handleSort = (column: ProjectSortBy) => {
    const next = nextSort<ProjectSortBy>(sortBy, sortDir, column);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (!next) {
      params.delete("sortBy");
      params.delete("sortDir");
    } else {
      params.set("sortBy", next.sortBy);
      params.set("sortDir", next.sortDir);
    }
    router.replace(`${pathname}?${params.toString()}`);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <DataWorkspace
        eyebrow="Data workspace"
        title="Projects"
        subtitle="Manage your project inventory and operational status."
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
            <p className="text-sm font-semibold text-ink">Project list</p>
            <div className="flex items-center gap-3 text-xs font-medium text-ink-soft">
              {loading ? "Updating..." : `Total: ${total}`}
            </div>
          </>
        }
        feedback={
          error ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-600">
              <span>{error}</span>
              <Button size="xs" variant="critical" onClick={fetchProjects}>
                Retry
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
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
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
        title={`Delete project "${deleteConfirmation.name}"?`}
        description={
          deleteConfirmation.loadingCounts ? (
            <p>Loading related elements...</p>
          ) : deleteConfirmation.countsError ? (
            <p className="text-danger-600">{deleteConfirmation.countsError}</p>
          ) : deleteConfirmation.hasRelated && deleteConfirmation.counts ? (
            <div className="space-y-2">
              <p>Cannot delete this project. It has related elements:</p>
              <ul className="list-disc pl-5 text-sm">
                {deleteConfirmation.counts.testPlans > 0 && <li>{deleteConfirmation.counts.testPlans} test plans</li>}
                {deleteConfirmation.counts.testSuites > 0 && <li>{deleteConfirmation.counts.testSuites} test suites</li>}
                {deleteConfirmation.counts.testCases > 0 && <li>{deleteConfirmation.counts.testCases} test cases</li>}
                {deleteConfirmation.counts.testRuns > 0 && <li>{deleteConfirmation.counts.testRuns} test runs</li>}
                {deleteConfirmation.counts.bugs > 0 && <li>{deleteConfirmation.counts.bugs} bugs</li>}
              </ul>
              <p>Please delete these elements first.</p>
            </div>
          ) : (
            "This action will permanently delete the project. This cannot be undone."
          )
        }
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() =>
          setDeleteConfirmation({
            open: false,
            id: null,
            name: "",
            isConfirming: false,
            loadingCounts: false,
            hasRelated: null,
            counts: null,
            countsError: null,
          })
        }
        isConfirming={deleteConfirmation.isConfirming}
        disableConfirm={deleteConfirmation.loadingCounts || !!deleteConfirmation.countsError || !!deleteConfirmation.hasRelated}
      />
    </div>
  );
}


