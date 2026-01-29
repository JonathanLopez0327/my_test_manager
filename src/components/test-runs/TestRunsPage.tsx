"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "../ui/Card";
import { Pagination } from "../ui/Pagination";
import { TestRunsHeader } from "./TestRunsHeader";
import { TestRunFormModal } from "./TestRunFormModal";
import { TestRunsTable } from "./TestRunsTable";
import { TestRunDetailsModal } from "./TestRunDetailsModal";
import type {
  TestRunPayload,
  TestRunRecord,
  TestRunsResponse,
} from "./types";
import type { ProjectsResponse } from "../projects/types";
import type { TestPlansResponse } from "../test-plans/types";
import type { TestSuitesResponse } from "../test-suites/types";

const DEFAULT_PAGE_SIZE = 10;

type ProjectOption = {
  id: string;
  key: string;
  name: string;
};

type TestPlanOption = {
  id: string;
  name: string;
  projectId: string;
  projectKey: string;
};

type TestSuiteOption = {
  id: string;
  name: string;
  testPlanId: string;
  testPlanName: string;
  projectId: string;
  projectKey: string;
};

export function TestRunsPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<TestRunRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TestRunRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRun, setDetailsRun] = useState<TestRunRecord | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [plans, setPlans] = useState<TestPlanOption[]>([]);
  const [suites, setSuites] = useState<TestSuiteOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);

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

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        query,
      });
      const response = await fetch(`/api/test-runs?${params.toString()}`);
      const data = (await response.json()) as TestRunsResponse & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los runs.");
      }
      setItems(data.items);
      setTotal(data.total);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron cargar los runs.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query]);

  const fetchOptions = useCallback(async () => {
    setOptionsError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        query: "",
      });
      const [projectsResponse, plansResponse, suitesResponse] =
        await Promise.all([
          fetch(`/api/projects?${params.toString()}`),
          fetch(`/api/test-plans?${params.toString()}`),
          fetch(`/api/test-suites?${params.toString()}`),
        ]);

      const [projectsData, plansData, suitesData] = await Promise.all([
        projectsResponse.json(),
        plansResponse.json(),
        suitesResponse.json(),
      ]);

      if (!projectsResponse.ok) {
        throw new Error(
          projectsData.message || "No se pudieron cargar los proyectos.",
        );
      }
      if (!plansResponse.ok) {
        throw new Error(
          plansData.message || "No se pudieron cargar los planes.",
        );
      }
      if (!suitesResponse.ok) {
        throw new Error(
          suitesData.message || "No se pudieron cargar las suites.",
        );
      }

      const projectsPayload = projectsData as ProjectsResponse;
      const plansPayload = plansData as TestPlansResponse;
      const suitesPayload = suitesData as TestSuitesResponse;

      setProjects(
        projectsPayload.items.map((project) => ({
          id: project.id,
          key: project.key,
          name: project.name,
        })),
      );
      setPlans(
        plansPayload.items.map((plan) => ({
          id: plan.id,
          name: plan.name,
          projectId: plan.projectId,
          projectKey: plan.project.key,
        })),
      );
      setSuites(
        suitesPayload.items.map((suite) => ({
          id: suite.id,
          name: suite.name,
          testPlanId: suite.testPlan.id,
          testPlanName: suite.testPlan.name,
          projectId: suite.testPlan.project.id,
          projectKey: suite.testPlan.project.key,
        })),
      );
    } catch (fetchError) {
      setOptionsError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron cargar los datos auxiliares.",
      );
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

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

  const handleEdit = (run: TestRunRecord) => {
    if (!canManage) return;
    setEditing(run);
    setModalOpen(true);
  };

  const handleView = (run: TestRunRecord) => {
    setDetailsRun(run);
    setDetailsOpen(true);
  };

  const handleDelete = async (run: TestRunRecord) => {
    if (!canManage) return;
    const confirmed = window.confirm(
      `¿Eliminar el run "${run.name ?? run.id}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/test-runs/${run.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "No se pudo eliminar el run.");
      }
      await fetchRuns();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el run.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (payload: TestRunPayload, runId?: string) => {
    const method = runId ? "PUT" : "POST";
    const endpoint = runId ? `/api/test-runs/${runId}` : "/api/test-runs";
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(data.message || "No se pudo guardar el run.");
    }
    await fetchRuns();
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <TestRunsHeader
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
              Listado de ejecuciones
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

        {optionsError ? (
          <div className="mt-4 rounded-lg bg-warning-500/10 px-4 py-3 text-sm text-warning-600">
            {optionsError}
          </div>
        ) : null}

        <div className="mt-6">
          <TestRunsTable
            items={items}
            loading={loading}
            onView={handleView}
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
        <TestRunFormModal
          open={modalOpen}
          run={editing}
          projects={projects}
          plans={plans}
          suites={suites}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      ) : null}

      <TestRunDetailsModal
        open={detailsOpen}
        run={detailsRun}
        canManage={canManage}
        onUpdated={fetchRuns}
        onClose={() => {
          setDetailsOpen(false);
          setDetailsRun(null);
        }}
      />
    </div>
  );
}
