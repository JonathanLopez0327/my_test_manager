import { z } from "zod";

export const aiChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  projectId: z.string().uuid(),
  conversationId: z.string().uuid(),
});

export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;

export const aiCreateConversationSchema = z.object({
  projectId: z.string().uuid(),
  environment: z.string().trim().min(1).max(32),
});

export const aiConversationsQuerySchema = z.object({
  projectId: z.string().uuid(),
});

export type AiCreateConversationRequest = z.infer<typeof aiCreateConversationSchema>;
