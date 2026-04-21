"use client";

import { useRequirementsChat } from "./useRequirementsChat";
import { RequirementsChatMessages } from "./RequirementsChatMessages";
import { RequirementsChatInput } from "./RequirementsChatInput";
import { RequirementsChatToolbar } from "./RequirementsChatToolbar";
import { RequirementsChatHistoryList } from "./RequirementsChatHistoryList";

type Props = {
  projectId: string;
};

export function RequirementsChat({ projectId }: Props) {
  const {
    state,
    activeConversation,
    sendMessage,
    setDraft,
    createConversation,
    selectConversation,
    toggleHistory,
  } = useRequirementsChat(projectId);

  const handleNewChat = () => {
    void createConversation();
  };

  const handleSelectConversation = (conversationId: string) => {
    selectConversation(conversationId);
    toggleHistory();
  };

  return (
    <div className="flex h-full flex-col">
      <RequirementsChatToolbar
        showHistory={state.showHistory}
        isBusy={state.isCreatingConversation || state.isSending}
        onNewChat={handleNewChat}
        onToggleHistory={toggleHistory}
      />

      {state.showHistory ? (
        <RequirementsChatHistoryList
          conversations={state.conversations}
          activeConversationId={state.activeConversationId}
          isLoading={state.isLoadingConversations}
          onSelect={handleSelectConversation}
        />
      ) : null}

      {state.error ? (
        <div className="mx-3 mt-2 rounded-lg border border-danger-500/20 bg-danger-500/10 px-2.5 py-1.5 text-[11px] font-medium text-danger-600">
          {state.error}
        </div>
      ) : null}

      <RequirementsChatMessages
        messages={activeConversation?.messages ?? []}
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
