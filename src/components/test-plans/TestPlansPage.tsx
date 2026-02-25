"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "../ui/Card";
import { Pagination } from "../ui/Pagination";
import { TestPlansHeader } from "./TestPlansHeader";
import { TestPlanFormSheet } from "./TestPlanFormSheet";
import { TestPlansTable } from "./TestPlansTable";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import type {
  TestPlanPayload,
  TestPlanRecord,
  TestPlansResponse,
  TestPlanSortBy,
  SortDir,
} from "./types";
import type { ProjectsResponse } from "../projects/types";
import { nextSort } from "@/lib/sorting";

const DEFAULT_PAGE_SIZE = 10;

type ProjectOption = {
  id: string;
  key: string;
  name: string;
};

export function TestPlansPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<TestPlanRecord[]>([]);
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
  const [editing, setEditing] = useState<TestPlanRecord | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const isReadOnlyGlobal = useMemo(
    () =>
      session?.user?.globalRoles?.some(
        (role) => role === "support" || role === "auditor",
      ) ?? false,
    [session?.user?.globalRoles],
  );

  const canManage = !isReadOnlyGlobal;
  const sortBy = (searchParams.get("sortBy") as TestPlanSortBy | null) ?? null;
  const sortDir = (searchParams.get("sortDir") as SortDir | null) ?? null;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const fetchTestPlans = useCallback(async () => {
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
      const response = await fetch(`/api/test-plans?${params.toString()}`);
      const data = (await response.json()) as TestPlansResponse & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los planes.");
      }
      setItems(data.items);
      setTotal(data.total);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron cargar los planes.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, sortBy, sortDir]);

  const fetchProjects = useCallback(async () => {
    setProjectsError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        query: "",
      });
      const response = await fetch(`/api/projects?${params.toString()}`);
      const data = (await response.json()) as ProjectsResponse & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los proyectos.");
      }
      setProjects(
        data.items.map((project) => ({
          id: project.id,
          key: project.key,
          name: project.name,
        })),
      );
    } catch (fetchError) {
      setProjectsError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron cargar los proyectos.",
      );
    }
  }, []);

  useEffect(() => {
    fetchTestPlans();
  }, [fetchTestPlans]);

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

  const handleEdit = (plan: TestPlanRecord) => {
    if (!canManage) return;
    setEditing(plan);
    setModalOpen(true);
  };

  const handleDelete = (plan: TestPlanRecord) => {
    if (!canManage) return;
    setDeleteConfirmation({
      open: true,
      id: plan.id,
      name: plan.name,
      isConfirming: false,
    });
  };

  const handleConfirmDelete = async () => {
    const { id } = deleteConfirmation;
    if (!id) return;

    setDeleteConfirmation((prev) => ({ ...prev, isConfirming: true }));
    setError(null);
    try {
      const response = await fetch(`/api/test-plans/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "No se pudo eliminar el plan.");
      }
      await fetchTestPlans();
      setDeleteConfirmation({ open: false, id: null, name: "", isConfirming: false });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el plan.",
      );
      setDeleteConfirmation((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const handleSave = async (payload: TestPlanPayload, planId?: string) => {
    const method = planId ? "PUT" : "POST";
    const endpoint = planId ? `/api/test-plans/${planId}` : "/api/test-plans";
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(data.message || "No se pudo guardar el plan.");
    }
    await fetchTestPlans();
  };

  const handleSort = (column: TestPlanSortBy) => {
    const next = nextSort<TestPlanSortBy>(sortBy, sortDir, column);
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
      <Card className="p-6">
        <TestPlansHeader
          query={query}
          onQueryChange={setQuery}
          onCreate={handleCreate}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          canCreate={canManage}
        />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">
              Listado de planes de prueba
            </p>
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

        {projectsError ? (
          <div className="mt-4 rounded-lg bg-warning-500/10 px-4 py-3 text-sm text-warning-600">
            {projectsError}
          </div>
        ) : null}

        <div className="mt-6">
          <TestPlansTable
            items={items}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            canManage={canManage}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
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

      {canManage ? (
        <TestPlanFormSheet
          open={modalOpen}
          plan={editing}
          projects={projects}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />

      ) : null}

      <ConfirmationDialog
        open={deleteConfirmation.open}
        title={`¿Eliminar plan "${deleteConfirmation.name}"?`}
        description="Esta acción eliminará el plan permanentemente. No se puede deshacer."
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
