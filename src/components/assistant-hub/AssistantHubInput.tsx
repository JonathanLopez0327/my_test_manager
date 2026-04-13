"use client";

import { type FormEvent, useRef } from "react";
import { useAssistantHub, getQuickActionsForContext } from "@/lib/assistant-hub";
import { insertTemplate } from "@/lib/assistant-hub/chat-helpers";
import { Button } from "@/components/ui/Button";
import { IconSend } from "@/components/icons";

export function AssistantHubInput() {
  const { state, actions } = useAssistantHub();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const quickActions = getQuickActionsForContext(state.context);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const content = state.draft.trim();
    if (!content || state.isSending) return;
    void actions.sendMessage(content);
  };

  const insertQuickAction = (template: string) => {
    actions.setDraft(insertTemplate(state.draft, template));
    textareaRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="shrink-0 border-t border-stroke bg-surface-elevated px-3 py-2.5">
      {state.error ? (
        <div className="mb-2 rounded-lg border border-danger-500/20 bg-danger-500/10 px-2.5 py-1.5 text-[11px] font-medium text-danger-600">
          {state.error}
        </div>
      ) : null}

      <div className="mb-2 flex flex-wrap gap-1">
        {quickActions.map((action) => (
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
          value={state.draft}
          onChange={(e) => actions.setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const content = state.draft.trim();
              if (content && !state.isSending) void actions.sendMessage(content);
            }
          }}
          placeholder="Ask about tests, runs, bugs..."
          rows={1}
          className="max-h-28 w-full resize-none bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-soft"
        />
        <Button
          type="submit"
          size="sm"
          className="h-8 w-8 shrink-0 rounded-lg p-0 text-white"
          disabled={state.isSending || state.draft.trim().length === 0}
          aria-label="Send message"
        >
          <IconSend className="h-4 w-4 shrink-0 text-white fill-white stroke-white" />
        </Button>
      </div>
    </form>
  );
}
