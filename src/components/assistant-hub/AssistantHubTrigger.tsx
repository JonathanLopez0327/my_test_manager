"use client";

import { useAssistantHub } from "@/lib/assistant-hub";
import type { AssistantEntityContext } from "@/lib/assistant-hub";
import { Button } from "@/components/ui/Button";
import { IconSpark } from "@/components/icons";
import { cn } from "@/lib/utils";

type AssistantHubTriggerProps = {
  context: AssistantEntityContext;
  label?: string;
  variant?: "button" | "icon" | "inline";
  className?: string;
  onBeforeOpen?: () => void;
};

export function AssistantHubTrigger({
  context,
  label = "Ask AI",
  variant = "button",
  className,
  onBeforeOpen,
}: AssistantHubTriggerProps) {
  const { actions } = useAssistantHub();

  const handleClick = () => {
    onBeforeOpen?.();
    actions.open(context);
  };

  if (variant === "icon") {
    return (
      <Button
        type="button"
        size="xs"
        variant="quiet"
        onClick={handleClick}
        aria-label={label}
        className={cn("h-8 w-8 rounded-full p-0", className)}
      >
        <IconSpark className="h-4 w-4 text-brand-600" />
      </Button>
    );
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1 text-[12px] font-medium text-brand-600 hover:text-brand-700 transition-colors",
          className,
        )}
      >
        <IconSpark className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }

  return (
    <Button
      type="button"
      size="xs"
      variant="secondary"
      onClick={handleClick}
      className={cn("gap-1.5", className)}
    >
      <IconSpark className="h-3.5 w-3.5 text-brand-600" />
      {label}
    </Button>
  );
}
