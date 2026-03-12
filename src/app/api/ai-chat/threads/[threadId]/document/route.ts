import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/ai/conversations";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { prisma } from "@/lib/prisma";
import { getS3Client, getS3Config } from "@/lib/s3";

export const runtime = "nodejs";

const DEFAULT_URL_EXPIRY_SECONDS = 120;

function resolveUrlExpirySeconds() {
  const raw = Number(process.env.AI_DOCUMENT_URL_EXPIRES_IN_SECONDS);
  if (!Number.isFinite(raw)) return DEFAULT_URL_EXPIRY_SECONDS;
  return Math.max(60, Math.min(120, Math.floor(raw)));
}

function toFilename(key: string) {
  const parts = key.split("/");
  return parts[parts.length - 1] || "document.pdf";
}

export const GET = withAuth(PERMISSIONS.PROJECT_LIST, async (_req, authCtx, routeCtx) => {
  const { threadId } = await routeCtx.params;
  const { activeOrganizationId, organizationRole, userId } = authCtx;

  if (!activeOrganizationId) {
    return NextResponse.json(
      { message: "You do not have an active organization." },
      { status: 403 },
    );
  }

  const normalizedThreadId = threadId?.trim();
  if (!normalizedThreadId) {
    return NextResponse.json(
      { message: "Invalid thread." },
      { status: 400 },
    );
  }

  const canReadOrgWide = organizationRole === "owner" || organizationRole === "admin";
  const conversation = await prisma.aiConversation.findFirst({
    where: {
      organizationId: activeOrganizationId,
      threadId: normalizedThreadId,
      ...(canReadOrgWide ? {} : { userId }),
    },
    select: {
      id: true,
      projectId: true,
    },
  });

  if (!conversation) {
    return NextResponse.json(
      { message: "Thread no encontrado." },
      { status: 404 },
    );
  }

  const hasAccess = await ensureProjectAccess({
    userId,
    organizationId: activeOrganizationId,
    organizationRole,
    projectId: conversation.projectId,
  });

  if (!hasAccess) {
    return NextResponse.json(
      { message: "You do not have access to the specified project." },
      { status: 403 },
    );
  }

  const { bucket } = getS3Config("test-documents");
  const keyPrefix = `${conversation.projectId}/${normalizedThreadId}/`;

  try {
    const client = getS3Client("test-documents");
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: keyPrefix,
      }),
    );

    const objects = listed.Contents ?? [];
    if (objects.length === 0) {
      return NextResponse.json(
        { status: "missing" },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const latestPdf = objects
      .filter((item) => item.Key?.toLowerCase().endsWith(".pdf"))
      .sort((left, right) => {
        const leftTime = left.LastModified?.getTime() ?? 0;
        const rightTime = right.LastModified?.getTime() ?? 0;
        return rightTime - leftTime;
      })[0];

    const key = latestPdf?.Key;
    if (!key) {
      return NextResponse.json(
        { status: "pending" },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const filename = toFilename(key);
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentType: "application/pdf",
        ResponseContentDisposition: `inline; filename="${filename}"`,
      }),
      { expiresIn: resolveUrlExpirySeconds() },
    );

    return NextResponse.json(
      {
        status: "ready",
        url,
        filename,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[ai-chat-document] lookup_failed", {
      threadId: normalizedThreadId,
      bucket,
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      { message: "Could not fetch the generated document." },
      { status: 502 },
    );
  }
});


