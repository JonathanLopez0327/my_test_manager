"use client";

import { type FormEvent, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { IconSend } from "@/components/icons";

type Props = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (message: string) => void;
  isSending: boolean;
};

const QUICK_ACTIONS = [
  { id: "functional", label: "Functional requirements", template: "Generate functional requirements for " },
  { id: "user-stories", label: "User stories", template: "Create user stories for " },
  { id: "acceptance", label: "Acceptance criteria", template: "Define acceptance criteria for " },
];

export function RequirementsChatInput({
  draft,
  onDraftChange,
  onSubmit,
  isSending,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;
    onSubmit(content);
  };

  const insertQuickAction = (template: string) => {
    onDraftChange(template);
    textareaRef.current?.focus();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-stroke bg-surface-elevated px-3 py-2.5"
    >
      <div className="mb-2 flex flex-wrap gap-1">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => insertQuickAction(action.template)}
            className="h-6 rounded-full border border-stroke bg-surface px-2 text-[10px] font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-1.5 rounded-xl border border-stroke bg-surface px-2.5 py-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const content = draft.trim();
              if (content && !isSending) onSubmit(content);
            }
          }}
          placeholder="Describe what requirements you need..."
          rows={1}
          className="max-h-28 w-full resize-none bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-soft"
        />
        <Button
          type="submit"
          size="sm"
          className="h-8 w-8 shrink-0 rounded-lg p-0 text-white"
          disabled={isSending || draft.trim().length === 0}
          aria-label="Send message"
        >
          <IconSend className="h-4 w-4 shrink-0 text-white fill-white stroke-white" />
        </Button>
      </div>
    </form>
  );
}
