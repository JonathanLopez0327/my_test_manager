"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "../ui/Card";
import { Pagination } from "../ui/Pagination";
import { TestSuitesHeader } from "./TestSuitesHeader";
import { TestSuiteFormModal } from "./TestSuiteFormModal";
import { TestSuitesTable } from "./TestSuitesTable";
import type {
  TestSuitePayload,
  TestSuiteRecord,
  TestSuitesResponse,
} from "./types";
import type { TestPlansResponse } from "../test-plans/types";

const DEFAULT_PAGE_SIZE = 10;

type TestPlanOption = {
  id: string;
  name: string;
  projectKey: string;
  projectName: string;
};

export function TestSuitesPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<TestSuiteRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
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
  }, [page, pageSize, query]);

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

  const handleDelete = async (suite: TestSuiteRecord) => {
    if (!canManage) return;
    const confirmed = window.confirm(
      `¿Eliminar la suite "${suite.name}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/test-suites/${suite.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "No se pudo eliminar la suite.");
      }
      await fetchSuites();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar la suite.",
      );
    } finally {
      setLoading(false);
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
        <TestSuiteFormModal
          open={modalOpen}
          suite={editing}
          testPlans={testPlans}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}
