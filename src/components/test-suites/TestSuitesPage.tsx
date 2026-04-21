"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "../ui/Pagination";
import { TestSuitesHeader } from "./TestSuitesHeader";
import { TestSuiteFormSheet } from "./TestSuiteFormSheet";
import { TestSuitesTable } from "./TestSuitesTable";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { DataWorkspace } from "../ui/DataWorkspace";
import { Button } from "../ui/Button";
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
    loadingCounts: boolean;
    hasRelated: boolean | null;
    counts: Record<string, number> | null;
    countsError: string | null;
  }>({ open: false, id: null, name: "", isConfirming: false, loadingCounts: false, hasRelated: null, counts: null, countsError: null });
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
        throw new Error(data.message || "Could not load test suites.");
      }
      setItems(data.items);
      setTotal(data.total);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load test suites.",
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
        throw new Error(data.message || "Could not load test plans.");
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
          : "Could not load test plans.",
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
    setDeleteConfirmation({
      open: true,
      id: suite.id,
      name: suite.name,
      isConfirming: false,
      loadingCounts: true,
      hasRelated: null,
      counts: null,
      countsError: null,
    });
    try {
      const res = await fetch(`/api/test-suites/${suite.id}/related-counts`);
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
      const response = await fetch(`/api/test-suites/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Could not delete test suite.");
      }
      await fetchSuites();
      setDeleteConfirmation({ open: false, id: null, name: "", isConfirming: false, loadingCounts: false, hasRelated: null, counts: null, countsError: null });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete test suite.",
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
      throw new Error(data.message || "Could not save test suite.");
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
      <DataWorkspace
        eyebrow="Data workspace"
        title="Test Suites"
        subtitle="Organize hierarchy and execution order inside each test plan."
        toolbar={
          <TestSuitesHeader
            query={query}
            onQueryChange={setQuery}
            onCreate={handleCreate}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            canCreate={canManage}
          />
        }
        status={
          <div className="ml-auto flex items-center gap-3 text-xs font-medium text-ink-soft">
            {loading ? "Updating..." : `Total: ${total}`}
          </div>
        }
        feedback={
          <>
            {error ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-600">
                <span>{error}</span>
                <Button size="xs" variant="critical" onClick={fetchSuites}>
                  Retry
                </Button>
              </div>
            ) : null}
            {plansError ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-warning-500/20 bg-warning-500/10 px-4 py-3 text-sm text-warning-500">
                <span>{plansError}</span>
                <Button size="xs" variant="soft" onClick={fetchTestPlans}>
                  Reload plans
                </Button>
              </div>
            ) : null}
          </>
        }
        content={
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
        title={`Delete test suite "${deleteConfirmation.name}"?`}
        description={
          deleteConfirmation.loadingCounts ? (
            <p>Loading related elements...</p>
          ) : deleteConfirmation.countsError ? (
            <p className="text-danger-600">{deleteConfirmation.countsError}</p>
          ) : deleteConfirmation.hasRelated && deleteConfirmation.counts ? (
            <div className="space-y-2">
              <p>Cannot delete this test suite. It has related elements:</p>
              <ul className="list-disc pl-5 text-sm">
                {deleteConfirmation.counts.childSuites > 0 && <li>{deleteConfirmation.counts.childSuites} child suites</li>}
                {deleteConfirmation.counts.testCases > 0 && <li>{deleteConfirmation.counts.testCases} test cases</li>}
              </ul>
              <p>Please delete these elements first.</p>
            </div>
          ) : (
            "This action will permanently delete the test suite. This cannot be undone."
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


