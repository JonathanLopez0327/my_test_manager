export type MessageRole = "user" | "assistant";

export type AiConversationMessageDto = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type AiConversationDto = {
  id: string;
  title: string;
  projectId: string;
  environment: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  messages: AiConversationMessageDto[];
};

export type AiConversationsResponse = {
  items: AiConversationDto[];
  total: number;
};
