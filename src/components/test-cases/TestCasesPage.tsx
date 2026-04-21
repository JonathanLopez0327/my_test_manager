"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "../ui/Pagination";
import { TestCasesHeader } from "./TestCasesHeader";
import { TestCaseFormSheet } from "./TestCaseFormSheet";
import { TestCaseDetailSheet } from "./TestCaseDetailSheet";
import { TestCasesTable } from "./TestCasesTable";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { DataWorkspace } from "../ui/DataWorkspace";
import { Button } from "../ui/Button";
import type {
  TestCasePayload,
  TestCaseRecord,
  TestCasesResponse,
  TestCaseTagsResponse,
  TestCaseSortBy,
  SortDir,
} from "./types";
import type { TestSuitesResponse } from "../test-suites/types";
import { nextSort } from "@/lib/sorting";
import { useScreenDataSync } from "@/lib/assistant-hub";
import type { ScreenData } from "@/lib/assistant-hub";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<TestCaseRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [suiteFilter, setSuiteFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDetailCase, setSelectedDetailCase] = useState<TestCaseRecord | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    id: string | null;
    title: string;
    isConfirming: boolean;
  }>({ open: false, id: null, title: "", isConfirming: false });
  const [duplicateConfirmation, setDuplicateConfirmation] = useState<{
    open: boolean;
    id: string | null;
    title: string;
    isConfirming: boolean;
  }>({ open: false, id: null, title: "", isConfirming: false });
  const [editing, setEditing] = useState<TestCaseRecord | null>(null);
  const [suites, setSuites] = useState<TestSuiteOption[]>([]);
  const [suitesError, setSuitesError] = useState<string | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const isReadOnlyGlobal = useMemo(
    () =>
      session?.user?.globalRoles?.some(
        (role) => role === "support" || role === "auditor",
      ) ?? false,
    [session?.user?.globalRoles],
  );

  const canManage = !isReadOnlyGlobal;
  const sortBy = (searchParams.get("sortBy") as TestCaseSortBy | null) ?? null;
  const sortDir = (searchParams.get("sortDir") as SortDir | null) ?? null;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const selectedSuiteName = useMemo(() => {
    if (!suiteFilter) return undefined;
    return suites.find((s) => s.id === suiteFilter)?.name;
  }, [suiteFilter, suites]);

  const screenData = useMemo<ScreenData>(() => ({
    viewType: "testCasesList",
    visibleItems: items.slice(0, 30).map((tc) => ({
      id: tc.id,
      title: tc.title,
      status: tc.status,
      priority: tc.priority != null ? String(tc.priority) : undefined,
    })),
    filters: {
      ...(suiteFilter && selectedSuiteName ? { suite: selectedSuiteName } : {}),
      ...(tagFilter ? { tag: tagFilter } : {}),
      ...(query ? { search: query } : {}),
    },
    summary: { total, page, pageSize },
  }), [items, suiteFilter, selectedSuiteName, tagFilter, query, total, page, pageSize]);

  useScreenDataSync(screenData);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        query,
      });
      if (suiteFilter) {
        params.set("suiteId", suiteFilter);
      }
      if (tagFilter) {
        params.set("tag", tagFilter);
      }
      if (sortBy && sortDir) {
        params.set("sortBy", sortBy);
        params.set("sortDir", sortDir);
      }
      const response = await fetch(`/api/test-cases?${params.toString()}`);
      const data = (await response.json()) as TestCasesResponse & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "Could not load test cases.");
      }
      setItems(data.items);
      setTotal(data.total);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load test cases.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, suiteFilter, tagFilter, sortBy, sortDir]);

  const fetchSuites = useCallback(async () => {
    setSuitesError(null);
    try {
      const allSuites: TestSuiteOption[] = [];
      const pageSizeForSuites = 50;
      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(pageSizeForSuites),
          query: "",
        });

        const response = await fetch(`/api/test-suites?${params.toString()}`);
        const data = (await response.json()) as TestSuitesResponse & {
          message?: string;
        };

        if (!response.ok) {
          throw new Error(data.message || "Could not load test suites.");
        }

        allSuites.push(
          ...data.items.map((suite) => ({
            id: suite.id,
            name: suite.name,
            testPlanName: suite.testPlan.name,
            projectKey: suite.testPlan.project.key,
            projectName: suite.testPlan.project.name,
          })),
        );

        hasMore = currentPage * data.pageSize < data.total;
        currentPage += 1;
      }

      setSuites(allSuites);
    } catch (fetchError) {
      setSuitesError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load test suites.",
      );
    }
  }, []);

  const fetchTags = useCallback(async () => {
    setTagsError(null);
    try {
      const params = new URLSearchParams();
      if (suiteFilter) {
        params.set("suiteId", suiteFilter);
      }
      const queryString = params.toString();
      const response = await fetch(
        queryString
          ? `/api/test-cases/tags?${queryString}`
          : "/api/test-cases/tags",
      );
      const data = (await response.json()) as TestCaseTagsResponse & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "Could not load test case tags.");
      }
      setTags(data.items);
    } catch (fetchError) {
      setTagsError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load test case tags.",
      );
    }
  }, [suiteFilter]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  useEffect(() => {
    fetchSuites();
  }, [fetchSuites]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    setTagFilter("");
  }, [suiteFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, suiteFilter, tagFilter]);

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

  const handleView = (testCase: TestCaseRecord) => {
    setSelectedDetailCase(testCase);
    setIsDetailOpen(true);
  };

  const handleDelete = (testCase: TestCaseRecord) => {
    if (!canManage) return;
    setDeleteConfirmation({
      open: true,
      id: testCase.id,
      title: testCase.title,
      isConfirming: false,
    });
  };

  const handleDuplicate = (testCase: TestCaseRecord) => {
    if (!canManage) return;
    setDuplicateConfirmation({
      open: true,
      id: testCase.id,
      title: testCase.title,
      isConfirming: false,
    });
  };

  const handleConfirmDuplicate = async () => {
    const { id } = duplicateConfirmation;
    if (!id) return;

    setDuplicateConfirmation((prev) => ({ ...prev, isConfirming: true }));
    setError(null);
    try {
      const response = await fetch(`/api/test-cases/${id}/duplicate`, {
        method: "POST",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Could not duplicate test case.");
      }
      await fetchCases();
      setDuplicateConfirmation({ open: false, id: null, title: "", isConfirming: false });
    } catch (dupError) {
      setError(
        dupError instanceof Error
          ? dupError.message
          : "Could not duplicate test case.",
      );
      setDuplicateConfirmation((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const handleConfirmDelete = async () => {
    const { id } = deleteConfirmation;
    if (!id) return;

    setDeleteConfirmation((prev) => ({ ...prev, isConfirming: true }));
    setError(null);
    try {
      const response = await fetch(`/api/test-cases/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Could not delete test case.");
      }
      await fetchCases();
      setDeleteConfirmation({ open: false, id: null, title: "", isConfirming: false });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete test case.",
      );
      setDeleteConfirmation((prev) => ({ ...prev, isConfirming: false }));
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
      throw new Error(data.message || "Could not save test case.");
    }
    await fetchCases();
  };

  const handleSort = (column: TestCaseSortBy) => {
    const next = nextSort<TestCaseSortBy>(sortBy, sortDir, column);
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

  const buildExportUrl = (format: "xlsx" | "pdf") => {
    const params = new URLSearchParams();
    params.set("format", format);
    if (query.trim()) params.set("query", query.trim());
    if (suiteFilter) params.set("suiteId", suiteFilter);
    if (tagFilter) params.set("tag", tagFilter);
    if (sortBy && sortDir) {
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
    }
    return `/api/test-cases/export?${params.toString()}`;
  };

  const handleExportExcel = () => {
    window.open(buildExportUrl("xlsx"), "_blank", "noopener,noreferrer");
  };

  const handleExportPdf = () => {
    window.open(buildExportUrl("pdf"), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <DataWorkspace
        eyebrow="Data workspace"
        title="Test Cases"
        subtitle="Manage reusable test coverage across suites and execution styles."
        toolbar={
          <TestCasesHeader
            query={query}
            onQueryChange={setQuery}
            suite={suiteFilter}
            onSuiteChange={setSuiteFilter}
            suiteOptions={suites.map((suite) => ({
              id: suite.id,
              label: `${suite.projectKey} · ${suite.testPlanName} · ${suite.name}`,
            }))}
            tag={tagFilter}
            onTagChange={setTagFilter}
            tagOptions={tags}
            onCreate={handleCreate}
            onExportExcel={handleExportExcel}
            onExportPdf={handleExportPdf}
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
                <Button size="xs" variant="critical" onClick={fetchCases}>
                  Retry
                </Button>
              </div>
            ) : null}
            {suitesError ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-warning-500/20 bg-warning-500/10 px-4 py-3 text-sm text-warning-500">
                <span>{suitesError}</span>
                <Button size="xs" variant="soft" onClick={fetchSuites}>
                  Reload suites
                </Button>
              </div>
            ) : null}
            {tagsError ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-warning-500/20 bg-warning-500/10 px-4 py-3 text-sm text-warning-500">
                <span>{tagsError}</span>
                <Button size="xs" variant="soft" onClick={fetchTags}>
                  Reload tags
                </Button>
              </div>
            ) : null}
          </>
        }
        content={
          <TestCasesTable
            items={items}
            loading={loading}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
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
        <TestCaseFormSheet
          open={modalOpen}
          testCase={editing}
          suites={suites}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      ) : null}

      <TestCaseDetailSheet
        open={isDetailOpen}
        testCase={selectedDetailCase}
        onClose={() => setIsDetailOpen(false)}
      />

      <ConfirmationDialog
        open={deleteConfirmation.open}
        title={`Delete test case "${deleteConfirmation.title}"?`}
        description="This action will permanently delete the test case. This cannot be undone."
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() =>
          setDeleteConfirmation({
            open: false,
            id: null,
            title: "",
            isConfirming: false,
          })
        }
        isConfirming={deleteConfirmation.isConfirming}
      />
      <ConfirmationDialog
        open={duplicateConfirmation.open}
        title={`Duplicate test case "${duplicateConfirmation.title}"?`}
        description="A new copy will be created in the same suite."
        confirmText="Duplicate"
        variant="info"
        onConfirm={handleConfirmDuplicate}
        onCancel={() =>
          setDuplicateConfirmation({
            open: false,
            id: null,
            title: "",
            isConfirming: false,
          })
        }
        isConfirming={duplicateConfirmation.isConfirming}
      />
    </div>
  );
}


