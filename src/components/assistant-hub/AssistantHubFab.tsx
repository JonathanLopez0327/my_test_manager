"use client";

import { useEffect } from "react";
import { useAssistantHub } from "@/lib/assistant-hub";
import { IconSpark } from "@/components/icons";
import { cn } from "@/lib/utils";

export function AssistantHubFab() {
  const { state, actions } = useAssistantHub();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "A") {
        e.preventDefault();
        actions.toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);

  if (state.isOpen) return null;

  return (
    <button
      type="button"
      onClick={() => actions.toggle()}
      aria-label="Open QA Assistant"
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md",
        "text-brand-600 transition-colors duration-200",
        "hover:bg-brand-50 hover:text-brand-700",
        "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        "active:scale-95",
      )}
    >
      <IconSpark className="h-5 w-5" />
    </button>
  );
}
