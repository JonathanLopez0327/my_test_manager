"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAssistantHub, getContextLabel } from "@/lib/assistant-hub";
import { IconSpark, IconPlus } from "@/components/icons";
import {
  XMarkIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowsPointingOutIcon,
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
  buildAssistantHubUrl,
} from "@/lib/assistant-hub/chat-helpers";

const CONTEXT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  project: FolderIcon,
  testRun: PlayIcon,
  testSuite: BeakerIcon,
  testCase: DocumentCheckIcon,
  bug: BugAntIcon,
};

export function AssistantHubHeader() {
  const { state, actions } = useAssistantHub();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentProjectId = getProjectIdFromContext(state.context);

  const isEntityContext = state.context.type !== "global" && state.context.type !== "project";

  const handleClearContext = () => {
    const parent = getParentContext(state.context);
    actions.setContext(parent);
  };

  const handleOpenInHub = () => {
    const currentSearch = searchParams.toString();
    const returnTo = `${pathname}${currentSearch ? `?${currentSearch}` : ""}`;
    const url = buildAssistantHubUrl(state.context, { returnTo });
    actions.close();
    router.push(url);
  };

  // Resolve project name for breadcrumb
  const projectName = currentProjectId
    ? (state.context.type === "project"
        ? state.context.projectName
        : "projectId" in state.context ? "Project" : null)
    : null;

  const ContextIcon = CONTEXT_ICONS[state.context.type] ?? null;
  const contextLabel = getContextLabel(state.context);

  return (
    <header className="shrink-0 border-b border-stroke">
      {/* Top row: title + window controls */}
      <div className="flex h-11 items-center justify-between px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
            <IconSpark className="h-3 w-3" />
          </span>
          <p className="truncate text-[13px] font-semibold text-ink">QA Assistant</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleOpenInHub}
            className="flex h-6 w-6 items-center justify-center rounded text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label="Open in full page"
            title="Open in full page"
          >
            <ArrowsPointingOutIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={actions.close}
            className="flex h-6 w-6 items-center justify-center rounded text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label="Close assistant"
            title="Close"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Context breadcrumb — shown when context is set to a specific entity */}
      {state.context.type !== "global" ? (
        <div className="flex items-center gap-1 border-t border-stroke/50 px-3 py-1.5">
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

      {/* Action bar: new chat + history toggle */}
      <div className="flex items-center gap-1.5 border-t border-stroke/50 px-3 py-1.5">
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
