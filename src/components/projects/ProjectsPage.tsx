"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { IconEdit, IconFolder, IconPlus } from "../icons";
import { ProjectFormSheet } from "./ProjectFormSheet";
import { ProjectOverviewTab } from "./ProjectOverviewTab";
import { RequirementsChat } from "./requirements-chat";
import { Button } from "../ui/Button";
import { SearchInput } from "../ui/SearchInput";
import { ProjectsSideList } from "./ProjectsSideList";
import { useAssistantHub, useScreenDataSync } from "@/lib/assistant-hub";
import type { ScreenData } from "@/lib/assistant-hub";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { cn } from "@/lib/utils";
import type { ProjectPayload, ProjectRecord, ProjectsResponse } from "./types";

type ProjectTab = "overview" | "requirements";

const LIST_PAGE_SIZE = 50;

export function ProjectsPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<ProjectRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProjectRecord | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    id: string | null;
    name: string;
    isConfirming: boolean;
    loadingCounts: boolean;
    hasRelated: boolean | null;
    counts: Record<string, number> | null;
    countsError: string | null;
  }>({
    open: false,
    id: null,
    name: "",
    isConfirming: false,
    loadingCounts: false,
    hasRelated: null,
    counts: null,
    countsError: null,
  });

  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");

  const isReadOnlyGlobal = useMemo(
    () =>
      session?.user?.globalRoles?.some(
        (role) => role === "support" || role === "auditor",
      ) ?? false,
    [session?.user?.globalRoles],
  );

  const canManage = !isReadOnlyGlobal;
  const { actions: hubActions } = useAssistantHub();

  // Auto-sync assistant hub context when a project is selected
  useEffect(() => {
    if (!selectedProjectId) return;
    const project = items.find((p) => p.id === selectedProjectId);
    if (!project) return;
    hubActions.setContext({ type: "project", projectId: project.id, projectName: project.name });
  }, [selectedProjectId, items, hubActions]);

  const screenData = useMemo<ScreenData>(() => ({
    viewType: "projectsList",
    visibleItems: items.slice(0, 30).map((p) => ({
      id: p.id,
      title: p.name,
      status: p.key,
    })),
    summary: { total },
    ...(query ? { filters: { search: query } } : {}),
  }), [items, total, query]);

  useScreenDataSync(screenData);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: String(LIST_PAGE_SIZE),
        query,
      });

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
  }, [query]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    setSelectedProjectId((previous) => {
      if (previous && items.some((item) => item.id === previous)) return previous;
      return items[0]?.id ?? null;
    });
  }, [items]);

  useEffect(() => {
    if (!selectedProjectId) return;
    setActiveTab("overview");
  }, [selectedProjectId]);

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
      const data = (await res.json()) as {
        hasRelated: boolean;
        counts: Record<string, number>;
        message?: string;
      };

      if (!res.ok) {
        throw new Error(data.message || "Could not load related counts.");
      }

      setDeleteConfirmation((prev) => ({
        ...prev,
        loadingCounts: false,
        hasRelated: data.hasRelated,
        counts: data.counts,
      }));
    } catch (deleteError) {
      setDeleteConfirmation((prev) => ({
        ...prev,
        loadingCounts: false,
        countsError:
          deleteError instanceof Error
            ? deleteError.message
            : "Could not load related counts.",
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
      setDeleteConfirmation({
        open: false,
        id: null,
        name: "",
        isConfirming: false,
        loadingCounts: false,
        hasRelated: null,
        counts: null,
        countsError: null,
      });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete project.",
      );
      setDeleteConfirmation((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDeleteFromSheet = async (project: ProjectRecord) => {
    setModalOpen(false);
    setEditing(null);
    await handleDelete(project);
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

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      {/* Left Panel */}
      <div className="flex w-[400px] shrink-0 flex-col border-r border-stroke bg-surface/50">
        <div className="flex items-center justify-between p-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Projects</h2>
            <p className="text-xs text-ink-muted">
              {loading ? "Updating..." : `Total: ${total}`}
            </p>
          </div>
          {canManage ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-9 w-9 rounded-xl border-brand-300 bg-brand-50 p-0 text-brand-700 hover:bg-brand-100"
              onClick={handleCreate}
              aria-label="Create project"
            >
              <IconPlus className="h-5 w-5 shrink-0 text-brand-700" />
            </Button>
          ) : null}
        </div>

        <div className="px-4 pb-2">
          <SearchInput
            placeholder="Search projects..."
            value={query}
            onChange={setQuery}
            containerClassName="w-full"
            aria-label="Search projects"
          />
        </div>

        {error ? (
          <div className="mx-4 mb-4 rounded-lg border border-danger-500/20 bg-danger-500/10 px-3 py-2.5 text-sm text-danger-600">
            <div className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <Button
                size="xs"
                variant="critical"
                onClick={() => void fetchProjects()}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-1">
          <ProjectsSideList
            items={items}
            loading={loading}
            selectedProjectId={selectedProjectId}
            onSelect={setSelectedProjectId}
          />
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface">
        {selectedProjectId ? (() => {
          const project = items.find((p) => p.id === selectedProjectId);
          if (!project) return null;

          return (
            <>
              <div className="flex items-center border-b border-stroke px-8 py-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-2xl font-bold tracking-tight text-ink">{project.name}</h2>
                    {canManage ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="quiet"
                        className="h-10 w-10 rounded-full p-0"
                        onClick={() => handleEdit(project)}
                        aria-label={`Edit project ${project.name}`}
                      >
                        <IconEdit className="h-5 w-5 text-ink-muted" />
                      </Button>
                    ) : null}
                  </div>
                  {project.description ? (
                    <p className="mt-1.5 text-sm text-ink-muted">{project.description}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2 border-b border-stroke px-8 py-3">
                <button
                  type="button"
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    activeTab === "overview"
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                  )}
                  onClick={() => setActiveTab("overview")}
                >
                  Overview
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    activeTab === "requirements"
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                  )}
                  onClick={() => setActiveTab("requirements")}
                >
                  Requirements
                </button>
              </div>

              <div className={cn(
                "min-h-0 flex-1",
                activeTab === "overview"
                  ? "overflow-y-auto p-8"
                  : "flex flex-col overflow-hidden",
              )}>
                {activeTab === "overview" ? (
                  <ProjectOverviewTab projectId={project.id} />
                ) : (
                  <RequirementsChat key={project.id} projectId={project.id} />
                )}
              </div>
            </>
          );
        })() : (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700">
                <IconFolder className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-tight text-ink">
                Projects workspace
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                Select a project from the left panel to keep context visible while you work.
              </p>
              {canManage ? (
                <Button
                  onClick={handleCreate}
                  size="sm"
                  className="mt-6"
                  variant="primary"
                >
                  <IconPlus className="h-4 w-4" />
                  New Project
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {canManage ? (
        <ProjectFormSheet
          open={modalOpen}
          project={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
          onDelete={handleDeleteFromSheet}
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
                {deleteConfirmation.counts.testPlans > 0 ? (
                  <li>{deleteConfirmation.counts.testPlans} test plans</li>
                ) : null}
                {deleteConfirmation.counts.testSuites > 0 ? (
                  <li>{deleteConfirmation.counts.testSuites} test suites</li>
                ) : null}
                {deleteConfirmation.counts.testCases > 0 ? (
                  <li>{deleteConfirmation.counts.testCases} test cases</li>
                ) : null}
                {deleteConfirmation.counts.testRuns > 0 ? (
                  <li>{deleteConfirmation.counts.testRuns} test runs</li>
                ) : null}
                {deleteConfirmation.counts.bugs > 0 ? (
                  <li>{deleteConfirmation.counts.bugs} bugs</li>
                ) : null}
              </ul>
              <p>Please delete these elements first.</p>
            </div>
          ) : (
            "This action will permanently delete the project. This cannot be undone."
          )
        }
        confirmText="Delete"
        onConfirm={() => void handleConfirmDelete()}
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
        disableConfirm={
          deleteConfirmation.loadingCounts ||
          Boolean(deleteConfirmation.countsError) ||
          Boolean(deleteConfirmation.hasRelated)
        }
      />
    </div>
  );
}
