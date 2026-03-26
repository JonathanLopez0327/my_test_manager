"use client";

import { useRequirementsChat } from "./useRequirementsChat";
import { RequirementsChatMessages } from "./RequirementsChatMessages";
import { RequirementsChatInput } from "./RequirementsChatInput";

type Props = {
  projectId: string;
};

export function RequirementsChat({ projectId }: Props) {
  const { state, sendMessage, setDraft } = useRequirementsChat(projectId);

  return (
    <div className="flex h-full flex-col">
      {state.error ? (
        <div className="mx-3 mt-2 rounded-lg border border-danger-500/20 bg-danger-500/10 px-2.5 py-1.5 text-[11px] font-medium text-danger-600">
          {state.error}
        </div>
      ) : null}

      <RequirementsChatMessages
        messages={state.messages}
        isSending={state.isSending}
        streamingContent={state.streamingContent}
      />

      <RequirementsChatInput
        draft={state.draft}
        onDraftChange={setDraft}
        onSubmit={(msg) => void sendMessage(msg)}
        isSending={state.isSending}
      />
    </div>
  );
}
