"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "../ui/Card";
import { Pagination } from "../ui/Pagination";
import { TestCasesHeader } from "./TestCasesHeader";
import { TestCaseFormModal } from "./TestCaseFormModal";
import { TestCasesTable } from "./TestCasesTable";
import type {
  TestCasePayload,
  TestCaseRecord,
  TestCasesResponse,
} from "./types";
import type { TestSuitesResponse } from "../test-suites/types";

const DEFAULT_PAGE_SIZE = 10;

type TestSuiteOption = {
  id: string;
  name: string;
  testPlanName: string;
  projectKey: string;
  projectName: string;
};

export function TestCasesPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<TestCaseRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TestCaseRecord | null>(null);
  const [suites, setSuites] = useState<TestSuiteOption[]>([]);
  const [suitesError, setSuitesError] = useState<string | null>(null);

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

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        query,
      });
      const response = await fetch(`/api/test-cases?${params.toString()}`);
      const data = (await response.json()) as TestCasesResponse & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los casos.");
      }
      setItems(data.items);
      setTotal(data.total);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron cargar los casos.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query]);

  const fetchSuites = useCallback(async () => {
    setSuitesError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        query: "",
      });
      const response = await fetch(`/api/test-suites?${params.toString()}`);
      const data = (await response.json()) as TestSuitesResponse & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar las suites.");
      }
      setSuites(
        data.items.map((suite) => ({
          id: suite.id,
          name: suite.name,
          testPlanName: suite.testPlan.name,
          projectKey: suite.testPlan.project.key,
          projectName: suite.testPlan.project.name,
        })),
      );
    } catch (fetchError) {
      setSuitesError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron cargar las suites.",
      );
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  useEffect(() => {
    fetchSuites();
  }, [fetchSuites]);

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

  const handleEdit = (testCase: TestCaseRecord) => {
    if (!canManage) return;
    setEditing(testCase);
    setModalOpen(true);
  };

  const handleDelete = async (testCase: TestCaseRecord) => {
    if (!canManage) return;
    const confirmed = window.confirm(
      `¿Eliminar el caso "${testCase.title}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/test-cases/${testCase.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "No se pudo eliminar el caso.");
      }
      await fetchCases();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el caso.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (payload: TestCasePayload, testCaseId?: string) => {
    const method = testCaseId ? "PUT" : "POST";
    const endpoint = testCaseId
      ? `/api/test-cases/${testCaseId}`
      : "/api/test-cases";
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(data.message || "No se pudo guardar el caso.");
    }
    await fetchCases();
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <TestCasesHeader
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
              Listado de casos de prueba
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

        {suitesError ? (
          <div className="mt-4 rounded-lg bg-warning-500/10 px-4 py-3 text-sm text-warning-600">
            {suitesError}
          </div>
        ) : null}

        <div className="mt-6">
          <TestCasesTable
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
        <TestCaseFormModal
          open={modalOpen}
          testCase={editing}
          suites={suites}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}
