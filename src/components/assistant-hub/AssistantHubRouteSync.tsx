"use client";

import { useEffect, useRef } from "react";
import { useAssistantHub } from "@/lib/assistant-hub";
import { getProjectIdFromContext } from "@/lib/assistant-hub/chat-helpers";

/**
 * Resets the Assistant Hub context to `global` when the route changes,
 * but preserves entity context if the user is still navigating within the
 * same project area (e.g. switching tabs inside a project).
 */
export function AssistantHubRouteSync({ pathname }: { pathname: string }) {
  const { state, actions } = useAssistantHub();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;

    // If context is already global, nothing to reset
    if (state.context.type === "global") return;

    // If context is entity-scoped and we're still in the same project area, preserve it
    const currentProjectId = getProjectIdFromContext(state.context);
    if (currentProjectId && pathname.includes(currentProjectId)) return;

    actions.setContext({ type: "global" });
  }, [pathname, actions, state.context]);

  return null;
}
