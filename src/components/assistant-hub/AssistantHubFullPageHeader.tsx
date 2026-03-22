"use client";

import { useEffect, useState } from "react";
import { useAssistantHub, getContextLabel } from "@/lib/assistant-hub";
import { IconSpark, IconPlus } from "@/components/icons";
import {
  XMarkIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  BugAntIcon,
  PlayIcon,
  BeakerIcon,
  DocumentCheckIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import {
  getProjectIdFromContext,
  getParentContext,
} from "@/lib/assistant-hub/chat-helpers";

type ProjectOption = { id: string; key: string; name: string };

const CONTEXT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  project: FolderIcon,
  testRun: PlayIcon,
  testSuite: BeakerIcon,
  testCase: DocumentCheckIcon,
  bug: BugAntIcon,
};

export function AssistantHubFullPageHeader() {
  const { state, actions } = useAssistantHub();
  const currentProjectId = getProjectIdFromContext(state.context);
  const isEntityContext = state.context.type !== "global" && state.context.type !== "project";

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingProjects(true);
      try {
        const res = await fetch("/api/projects?page=1&pageSize=50&query=");
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { items: ProjectOption[] };
        if (active) setProjects(data.items);
      } catch {
        // silently fail
      } finally {
        if (active) setLoadingProjects(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value;
    if (!projectId) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    actions.setContext({ type: "project", projectId: project.id, projectName: project.name });
  };

  const handleClearContext = () => {
    const projectName = currentProjectId
      ? projects.find((p) => p.id === currentProjectId)?.name
      : undefined;
    const parent = getParentContext(state.context, projectName);
    actions.setContext(parent);
  };

  const projectName = currentProjectId
    ? (state.context.type === "project"
        ? state.context.projectName
        : projects.find((p) => p.id === currentProjectId)?.name ?? "Project")
    : null;

  const ContextIcon = CONTEXT_ICONS[state.context.type] ?? null;
  const contextLabel = getContextLabel(state.context);

  return (
    <header className="shrink-0 border-b border-stroke">
      {/* Top row: title */}
      <div className="flex h-12 items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
            <IconSpark className="h-3.5 w-3.5" />
          </span>
          <p className="truncate text-sm font-semibold text-ink">QA Assistant</p>
        </div>
      </div>

      {/* Context breadcrumb */}
      {state.context.type !== "global" ? (
        <div className="flex items-center gap-1 border-t border-stroke/50 px-4 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1 text-[11px]">
            {isEntityContext && projectName ? (
              <>
                <FolderIcon className="h-3 w-3 shrink-0 text-ink-muted" />
                <button
                  type="button"
                  onClick={() => {
                    actions.setContext({ type: "project", projectId: currentProjectId!, projectName: projectName });
                  }}
                  className="truncate font-medium text-ink-muted transition-colors hover:text-ink"
                  title={projectName}
                >
                  {projectName}
                </button>
                <ChevronRightIcon className="h-2.5 w-2.5 shrink-0 text-ink-soft" />
              </>
            ) : null}
            {ContextIcon ? <ContextIcon className="h-3 w-3 shrink-0 text-brand-600" /> : null}
            <span className="truncate font-medium text-ink" title={contextLabel}>
              {state.context.type === "project" ? projectName : contextLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClearContext}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label="Clear context"
            title="Clear context"
          >
            <XMarkIcon className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      {/* Project selector */}
      <div className="border-t border-stroke/50 px-4 py-1.5">
        <select
          value={currentProjectId ?? ""}
          onChange={handleProjectChange}
          disabled={loadingProjects}
          className="h-7 w-full max-w-xs rounded-lg border border-stroke bg-surface-elevated px-2 text-[11px] font-medium text-ink transition-colors hover:border-brand-500/40 focus:border-brand-500 focus:outline-none disabled:opacity-50 dark:bg-surface-muted"
        >
          <option value="">
            {loadingProjects ? "Loading projects..." : "Select a project..."}
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.key} · {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1.5 border-t border-stroke/50 px-4 py-1.5">
        <button
          type="button"
          onClick={async () => {
            const id = await actions.createConversation();
            if (id) actions.setDraft("");
          }}
          className="flex h-7 items-center gap-1.5 rounded-lg border border-stroke bg-surface px-2.5 text-[11px] font-medium text-ink-muted transition-colors hover:border-brand-500/40 hover:bg-brand-50/50 hover:text-ink"
        >
          <IconPlus className="h-3 w-3" />
          New chat
        </button>

        <button
          type="button"
          onClick={actions.toggleHistory}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors",
            state.showHistory
              ? "border-brand-500/40 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100"
              : "border-stroke bg-surface text-ink-muted hover:border-brand-500/40 hover:bg-brand-50/50 hover:text-ink",
          )}
        >
          <ClockIcon className="h-3 w-3" />
          History
          <ChevronDownIcon
            className={cn(
              "h-2.5 w-2.5 transition-transform",
              state.showHistory && "rotate-180",
            )}
          />
        </button>
      </div>
    </header>
  );
}
