"use client";

import { useEffect, useRef } from "react";
import { useAssistantHub } from "@/lib/assistant-hub";

/**
 * Resets the Assistant Hub context to `global` whenever the route changes.
 * Individual pages (e.g. ProjectsPage) can then override with their own context.
 */
export function AssistantHubRouteSync({ pathname }: { pathname: string }) {
  const { actions } = useAssistantHub();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      actions.setContext({ type: "global" });
    }
  }, [pathname, actions]);

  return null;
}
