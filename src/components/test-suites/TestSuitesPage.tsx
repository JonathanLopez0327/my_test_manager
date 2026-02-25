"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "../ui/Card";
import { Pagination } from "../ui/Pagination";
import { TestSuitesHeader } from "./TestSuitesHeader";
import { TestSuiteFormSheet } from "./TestSuiteFormSheet";
import { TestSuitesTable } from "./TestSuitesTable";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import type {
  TestSuitePayload,
  TestSuiteRecord,
  TestSuitesResponse,
  TestSuiteSortBy,
  SortDir,
} from "./types";
import type { TestPlansResponse } from "../test-plans/types";
import { nextSort } from "@/lib/sorting";

const DEFAULT_PAGE_SIZE = 10;

type TestPlanOption = {
  id: string;
  name: string;
  projectKey: string;
  projectName: string;
};

export function TestSuitesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<TestSuiteRecord[]>([]);
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
  const [editing, setEditing] = useState<TestSuiteRecord | null>(null);
  const [testPlans, setTestPlans] = useState<TestPlanOption[]>([]);
  const [plansError, setPlansError] = useState<string | null>(null);

  const isReadOnlyGlobal = useMemo(
    () =>
      session?.user?.globalRoles?.some(
        (role) => role === "support" || role === "auditor",
      ) ?? false,
    [session?.user?.globalRoles],
  );

  const canManage = !isReadOnlyGlobal;
  const sortBy = (searchParams.get("sortBy") as TestSuiteSortBy | null) ?? null;
  const sortDir = (searchParams.get("sortDir") as SortDir | null) ?? null;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const fetchSuites = useCallback(async () => {
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
      const response = await fetch(`/api/test-suites?${params.toString()}`);
      const data = (await response.json()) as TestSuitesResponse & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar las suites.");
      }
      setItems(data.items);
      setTotal(data.total);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron cargar las suites.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, sortBy, sortDir]);

  const fetchTestPlans = useCallback(async () => {
    setPlansError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        query: "",
      });
      const response = await fetch(`/api/test-plans?${params.toString()}`);
      const data = (await response.json()) as TestPlansResponse & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los planes.");
      }
      setTestPlans(
        data.items.map((plan) => ({
          id: plan.id,
          name: plan.name,
          projectKey: plan.project.key,
          projectName: plan.project.name,
        })),
      );
    } catch (fetchError) {
      setPlansError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron cargar los planes.",
      );
    }
  }, []);

  useEffect(() => {
    fetchSuites();
  }, [fetchSuites]);

  useEffect(() => {
    fetchTestPlans();
  }, [fetchTestPlans]);

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

  const handleEdit = (suite: TestSuiteRecord) => {
    if (!canManage) return;
    setEditing(suite);
    setModalOpen(true);
  };

  const handleDelete = (suite: TestSuiteRecord) => {
    if (!canManage) return;
    setDeleteConfirmation({
      open: true,
      id: suite.id,
      name: suite.name,
      isConfirming: false,
    });
  };

  const handleConfirmDelete = async () => {
    const { id } = deleteConfirmation;
    if (!id) return;

    setDeleteConfirmation((prev) => ({ ...prev, isConfirming: true }));
    setError(null);
    try {
      const response = await fetch(`/api/test-suites/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "No se pudo eliminar la suite.");
      }
      await fetchSuites();
      setDeleteConfirmation({ open: false, id: null, name: "", isConfirming: false });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar la suite.",
      );
      setDeleteConfirmation((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const handleSave = async (payload: TestSuitePayload, suiteId?: string) => {
    const method = suiteId ? "PUT" : "POST";
    const endpoint = suiteId
      ? `/api/test-suites/${suiteId}`
      : "/api/test-suites";
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(data.message || "No se pudo guardar la suite.");
    }
    await fetchSuites();
  };

  const handleSort = (column: TestSuiteSortBy) => {
    const next = nextSort<TestSuiteSortBy>(sortBy, sortDir, column);
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
        <TestSuitesHeader
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
              Listado de suites de prueba
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

        {plansError ? (
          <div className="mt-4 rounded-lg bg-warning-500/10 px-4 py-3 text-sm text-warning-600">
            {plansError}
          </div>
        ) : null}

        <div className="mt-6">
          <TestSuitesTable
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
        <TestSuiteFormSheet
          open={modalOpen}
          suite={editing}
          testPlans={testPlans}
          onClose={() => setModalOpen(false)}

          onSave={handleSave}
        />
      ) : null}

      <ConfirmationDialog
        open={deleteConfirmation.open}
        title={`¿Eliminar suite "${deleteConfirmation.name}"?`}
        description="Esta acción eliminará la suite permanentemente. No se puede deshacer."
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
