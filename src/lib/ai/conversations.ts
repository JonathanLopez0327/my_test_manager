import { prisma } from "@/lib/prisma";

type AccessParams = {
  userId: string;
  organizationId: string;
  organizationRole?: "owner" | "admin" | "member" | "billing";
  projectId?: string | null;
};

export const ACTIVE_CONVERSATION_LIMIT = 5;

export function titleFromPrompt(prompt: string): string {
  return prompt.trim().slice(0, 56) || "New conversation";
}

export async function ensureProjectAccess({
  userId,
  organizationId,
  organizationRole,
  projectId,
}: AccessParams): Promise<boolean> {
  if (!projectId) return true; // global scope — accessible to all authenticated org members

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!project) return false;

  if (organizationRole === "owner" || organizationRole === "admin") {
    return true;
  }

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    select: { userId: true },
  });

  return Boolean(membership);
}

export async function archiveOverflowConversations(params: {
  userId: string;
  projectId?: string | null;
  agent?: string;
}) {
  const agent = params.agent ?? "chat";
  const activeRows = await prisma.aiConversation.findMany({
    where: {
      userId: params.userId,
      ...(params.projectId ? { projectId: params.projectId } : {}),
      agent,
      status: "active",
    },
    select: { id: true },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  });

  if (activeRows.length <= ACTIVE_CONVERSATION_LIMIT) return;

  const toArchive = activeRows.slice(ACTIVE_CONVERSATION_LIMIT).map((row) => row.id);

  await prisma.aiConversation.updateMany({
    where: { id: { in: toArchive } },
    data: {
      status: "archived",
      archivedAt: new Date(),
    },
  });
}

export async function listActiveConversations(params: {
  userId: string;
  projectId?: string | null;
  agent?: string;
}) {
  const agent = params.agent ?? "chat";
  return prisma.aiConversation.findMany({
    where: {
      userId: params.userId,
      ...(params.projectId ? { projectId: params.projectId } : {}),
      agent,
      status: "active",
    },
    include: {
      messages: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: ACTIVE_CONVERSATION_LIMIT,
  });
}

export function mapConversationDto(
  conversation: Awaited<ReturnType<typeof listActiveConversations>>[number],
) {
  return {
    id: conversation.id,
    title: conversation.title,
    projectId: conversation.projectId,
    environment: conversation.environment,
    agent: conversation.agent,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    threadId: conversation.threadId,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}
