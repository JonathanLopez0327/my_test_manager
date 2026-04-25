import { z } from "zod";

const screenDataItemSchema = z.object({
  id: z.string().max(64),
  title: z.string().max(256),
  status: z.string().max(32).optional(),
  priority: z.string().max(16).optional(),
});

const screenDataSchema = z.object({
  viewType: z.string().max(64).optional(),
  visibleItems: z.array(screenDataItemSchema).max(30).optional(),
  filters: z.record(z.string(), z.string().max(128)).optional(),
  summary: z.record(z.string(), z.union([z.number(), z.string().max(128)])).optional(),
  breadcrumb: z.array(z.string().max(128)).max(10).optional(),
}).optional();

export const entityContextSchema = z.object({
  type: z.string().min(1).max(32),
  entityId: z.string().uuid().optional(),
  entityName: z.string().max(256).optional(),
  projectId: z.string().uuid().optional(),
  screenData: screenDataSchema,
}).optional();

export const aiChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  projectId: z.string().uuid().optional(),
  conversationId: z.string().uuid(),
  entityContext: entityContextSchema,
});

export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;

export const aiCreateConversationSchema = z.object({
  projectId: z.string().uuid().optional(),
  environment: z.string().trim().min(1).max(32).optional(),
});

export const aiConversationsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
});

export type AiCreateConversationRequest = z.infer<typeof aiCreateConversationSchema>;

const approvalDecisionSchema = z.union([
  z.object({ approve_all: z.literal(true) }).strict(),
  z.object({ approved: z.array(z.string().min(1).max(128)).max(50) }).strict(),
]);

export const aiApprovalRequestSchema = z.object({
  conversationId: z.string().uuid(),
  threadId: z.string().min(1).max(128),
  decision: approvalDecisionSchema,
});

export type AiApprovalRequest = z.infer<typeof aiApprovalRequestSchema>;

export const aiRequirementsChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  projectId: z.string().uuid(),
  conversationId: z.string().uuid(),
});

export const aiRequirementsConversationsQuerySchema = z.object({
  projectId: z.string().uuid(),
});

export const aiRequirementsCreateConversationSchema = z.object({
  projectId: z.string().uuid(),
});
