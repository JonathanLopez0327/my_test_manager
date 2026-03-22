import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireBugPermission } from "@/lib/auth/require-bug-permission";
import { maybeSignAttachmentUrl, serializeSizeBytes } from "@/lib/bug-attachments";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const dynamic = "force-dynamic";

export const GET = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;
  const access = await requireBugPermission(
    userId,
    globalRoles,
    id,
    PERMISSIONS.BUG_ATTACHMENT_LIST,
    activeOrganizationId,
    organizationRole,
  );
  if (access.error) return access.error;

  const { searchParams } = new URL(req.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  const [items, total] = await prisma.$transaction([
    prisma.bugAttachment.findMany({
      where: { bugId: id },
      select: {
        id: true,
        bugId: true,
        type: true,
        name: true,
        url: true,
        mimeType: true,
        sizeBytes: true,
        checksumSha256: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.bugAttachment.count({
      where: { bugId: id },
    }),
  ]);

  const signedItems = await Promise.all(
    items.map(async (item) => ({
      ...item,
      url: await maybeSignAttachmentUrl(item.url),
      sizeBytes: serializeSizeBytes(item.sizeBytes),
    })),
  );

  return NextResponse.json(
    {
      items: signedItems,
      total,
      page,
      pageSize,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
});
