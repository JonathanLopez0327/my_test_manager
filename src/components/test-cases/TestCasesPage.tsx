"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "../ui/Card";
import { Pagination } from "../ui/Pagination";
import { TestCasesHeader } from "./TestCasesHeader";
import { TestCaseFormSheet } from "./TestCaseFormSheet";
import { TestCasesTable } from "./TestCasesTable";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import type {
  TestCasePayload,
  TestCaseRecord,
  TestCasesResponse,
  TestCaseTagsResponse,
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
  const [suiteFilter, setSuiteFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
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
      if (suiteFilter) {
        params.set("suiteId", suiteFilter);
      }
      if (tagFilter) {
        params.set("tag", tagFilter);
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
  }, [page, pageSize, query, suiteFilter, tagFilter]);

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

  const handleDelete = (testCase: TestCaseRecord) => {
    if (!canManage) return;
    setDeleteConfirmation({
      open: true,
      id: testCase.id,
      title: testCase.title,
      isConfirming: false,
    });
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

  return (
    <div className="space-y-6">
      <Card className="p-6">
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
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          canCreate={canManage}
        />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">
              Test Cases List
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-soft">
            {loading ? "Updating..." : `Total: ${total}`}
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

        {tagsError ? (
          <div className="mt-4 rounded-lg bg-warning-500/10 px-4 py-3 text-sm text-warning-600">
            {tagsError}
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
        <TestCaseFormSheet
          open={modalOpen}
          testCase={editing}
          suites={suites}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />

      ) : null}

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
    </div>
  );
}
