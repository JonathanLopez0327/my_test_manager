import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import {
  archiveOverflowConversations,
  ensureProjectAccess,
  listActiveConversations,
  mapConversationDto,
} from "@/lib/ai/conversations";
import { aiConversationsQuerySchema, aiCreateConversationSchema } from "@/lib/ai/schemas";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const DEFAULT_CONVERSATION_ENVIRONMENT = "DEV";

export const GET = withAuth(PERMISSIONS.PROJECT_LIST, async (req, authCtx) => {
  const { activeOrganizationId, userId, organizationRole } = authCtx;
  if (!activeOrganizationId) {
    return NextResponse.json(
      { message: "You do not have an active organization." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = aiConversationsQuerySchema.safeParse({
    projectId: searchParams.get("projectId")?.trim(),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { projectId } = parsed.data;

  if (projectId) {
    const hasAccess = await ensureProjectAccess({
      userId,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId,
    });

    if (!hasAccess) {
      return NextResponse.json(
        { message: "You do not have access to the specified project." },
        { status: 403 },
      );
    }
  }

  const rows = await listActiveConversations({ userId, projectId: projectId ?? null });

  return NextResponse.json({
    items: rows.map(mapConversationDto),
    total: rows.length,
  });
});

export const POST = withAuth(PERMISSIONS.PROJECT_LIST, async (req, authCtx) => {
  const { activeOrganizationId, userId, organizationRole } = authCtx;
  if (!activeOrganizationId) {
    return NextResponse.json(
      { message: "You do not have an active organization." },
      { status: 403 },
    );
  }

  const bodyJson = await req.json().catch(() => null);
  const parsed = aiCreateConversationSchema.safeParse(bodyJson);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { projectId, environment } = parsed.data;

  if (projectId) {
    const hasAccess = await ensureProjectAccess({
      userId,
      organizationId: activeOrganizationId,
      organizationRole,
      projectId,
    });

    if (!hasAccess) {
      return NextResponse.json(
        { message: "You do not have access to the specified project." },
        { status: 403 },
      );
    }
  }

  const now = new Date();
  const created = await prisma.aiConversation.create({
    data: {
      organizationId: activeOrganizationId,
      ...(projectId ? { projectId } : {}),
      userId,
      title: "New conversation",
      environment: environment?.trim() || DEFAULT_CONVERSATION_ENVIRONMENT,
      status: "active",
      lastMessageAt: now,
    },
    include: {
      messages: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });

  await archiveOverflowConversations({ userId, projectId: projectId ?? null });

  return NextResponse.json({ item: mapConversationDto(created) }, { status: 201 });
});



