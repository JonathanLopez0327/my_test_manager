"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "../ui/Pagination";
import { TestPlansHeader } from "./TestPlansHeader";
import { TestPlanFormSheet } from "./TestPlanFormSheet";
import { TestPlansTable } from "./TestPlansTable";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { DataWorkspace } from "../ui/DataWorkspace";
import { Button } from "../ui/Button";
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
    loadingCounts: boolean;
    hasRelated: boolean | null;
    counts: Record<string, number> | null;
    countsError: string | null;
  }>({ open: false, id: null, name: "", isConfirming: false, loadingCounts: false, hasRelated: null, counts: null, countsError: null });
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
        throw new Error(data.message || "Could not load test plans.");
      }
      setItems(data.items);
      setTotal(data.total);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load test plans.",
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
        throw new Error(data.message || "Could not load projects.");
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
          : "Could not load projects.",
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

  const handleDelete = async (plan: TestPlanRecord) => {
    if (!canManage) return;
    setDeleteConfirmation({
      open: true,
      id: plan.id,
      name: plan.name,
      isConfirming: false,
      loadingCounts: true,
      hasRelated: null,
      counts: null,
      countsError: null,
    });
    try {
      const res = await fetch(`/api/test-plans/${plan.id}/related-counts`);
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
      const response = await fetch(`/api/test-plans/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Could not delete test plan.");
      }
      await fetchTestPlans();
      setDeleteConfirmation({ open: false, id: null, name: "", isConfirming: false, loadingCounts: false, hasRelated: null, counts: null, countsError: null });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete test plan.",
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
      throw new Error(data.message || "Could not save test plan.");
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
      <DataWorkspace
        eyebrow="Data workspace"
        title="Test Plans"
        subtitle="Track planning windows, ownership, and progress by project."
        toolbar={
          <TestPlansHeader
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
                <Button size="xs" variant="critical" onClick={fetchTestPlans}>
                  Retry
                </Button>
              </div>
            ) : null}
            {projectsError ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-warning-500/20 bg-warning-500/10 px-4 py-3 text-sm text-warning-500">
                <span>{projectsError}</span>
                <Button size="xs" variant="soft" onClick={fetchProjects}>
                  Reload projects
                </Button>
              </div>
            ) : null}
          </>
        }
        content={
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
        title={`Delete test plan "${deleteConfirmation.name}"?`}
        description={
          deleteConfirmation.loadingCounts ? (
            <p>Loading related elements...</p>
          ) : deleteConfirmation.countsError ? (
            <p className="text-danger-600">{deleteConfirmation.countsError}</p>
          ) : deleteConfirmation.hasRelated && deleteConfirmation.counts ? (
            <div className="space-y-2">
              <p>Cannot delete this test plan. It has related elements:</p>
              <ul className="list-disc pl-5 text-sm">
                {deleteConfirmation.counts.testSuites > 0 && <li>{deleteConfirmation.counts.testSuites} test suites</li>}
                {deleteConfirmation.counts.testCases > 0 && <li>{deleteConfirmation.counts.testCases} test cases</li>}
                {deleteConfirmation.counts.testRuns > 0 && <li>{deleteConfirmation.counts.testRuns} test runs</li>}
              </ul>
              <p>Please delete these elements first.</p>
            </div>
          ) : (
            "This action will permanently delete the test plan. This cannot be undone."
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


