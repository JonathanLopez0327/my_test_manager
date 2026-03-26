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
        "fixed bottom-20 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full",
        "bg-brand-600 text-white shadow-lg",
        "transition-all duration-200 ease-[var(--ease-emphasis)]",
        "hover:bg-brand-700 hover:scale-105 hover:shadow-xl",
        "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        "active:scale-95",
      )}
    >
      <IconSpark className="h-6 w-6" />
    </button>
  );
}
