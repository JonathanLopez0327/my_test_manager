import { z } from "zod";

export const entityContextSchema = z.object({
  type: z.string().min(1).max(32),
  entityId: z.string().uuid().optional(),
}).optional();

export const aiChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  projectId: z.string().uuid().optional(),
  conversationId: z.string().uuid(),
  entityContext: entityContextSchema,
});

export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;

export const aiCreateConversationSchema = z.object({
  projectId: z.string().uuid(),
  environment: z.string().trim().min(1).max(32).optional(),
});

export const aiConversationsQuerySchema = z.object({
  projectId: z.string().uuid(),
});

export type AiCreateConversationRequest = z.infer<typeof aiCreateConversationSchema>;
