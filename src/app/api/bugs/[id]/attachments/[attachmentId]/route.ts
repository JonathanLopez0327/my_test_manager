import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireBugPermission } from "@/lib/auth/require-bug-permission";
import { getS3Client, getS3Config } from "@/lib/s3";

export const DELETE = withAuth(null, async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id, attachmentId } = await routeCtx.params;
  const access = await requireBugPermission(
    userId,
    globalRoles,
    id,
    PERMISSIONS.BUG_ATTACHMENT_DELETE,
    activeOrganizationId,
    organizationRole,
  );
  if (access.error) return access.error;

  try {
    const attachment = await prisma.bugAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return NextResponse.json(
        { message: "Attachment not found." },
        { status: 404 },
      );
    }

    if (attachment.bugId !== access.bug.id) {
      return NextResponse.json(
        { message: "The attachment does not belong to this bug." },
        { status: 400 },
      );
    }

    const { bucket, endpoint } = getS3Config("artifacts");
    const base = (process.env.S3_PUBLIC_URL ?? endpoint).replace(/\/$/, "");
    const bucketPrefix = `${base}/${bucket}/`;

    if (attachment.url.startsWith(bucketPrefix)) {
      const encodedKey = attachment.url.slice(bucketPrefix.length);
      const key = decodeURI(encodedKey);

      const client = getS3Client("artifacts");
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
    }

    await prisma.bugAttachment.delete({
      where: { id: attachmentId },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { message: "Could not delete the attachment." },
      { status: 500 },
    );
  }
});
