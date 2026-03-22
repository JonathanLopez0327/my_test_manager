import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireBugPermission } from "@/lib/auth/require-bug-permission";
import { buildS3ObjectUrl, getS3Client, getS3Config } from "@/lib/s3";
import { validateArtifactUploadPolicy } from "@/lib/artifact-upload-policy";
import {
  inferAttachmentTypeFromMime,
  parseAttachmentType,
  sanitizeAttachmentFileName,
  serializeSizeBytes,
} from "@/lib/bug-attachments";

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;
  const access = await requireBugPermission(
    userId,
    globalRoles,
    id,
    PERMISSIONS.BUG_ATTACHMENT_UPLOAD,
    activeOrganizationId,
    organizationRole,
  );
  if (access.error) return access.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { message: "File is required." },
        { status: 400 },
      );
    }

    const rawType = parseAttachmentType(String(formData.get("type") ?? "").trim() || null);
    const type = rawType ?? inferAttachmentTypeFromMime(file.type);

    const uploadPolicy = validateArtifactUploadPolicy({
      type,
      sizeBytes: file.size,
      requirePositiveSize: true,
    });

    if (!uploadPolicy.ok) {
      return NextResponse.json(
        { message: uploadPolicy.message },
        { status: 400 },
      );
    }

    if (type === "screenshot" && !(file.type || "").toLowerCase().startsWith("image/")) {
      return NextResponse.json(
        { message: "Only image files are allowed for screenshot attachments." },
        { status: 400 },
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha256").update(fileBuffer).digest("hex");
    const safeName = sanitizeAttachmentFileName(file.name || "attachment");
    const key = `bugs/${id}/${Date.now()}-${safeName}`;

    const { bucket } = getS3Config("artifacts");
    const client = getS3Client("artifacts");
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: file.type || "application/octet-stream",
      }),
    );

    const url = buildS3ObjectUrl("artifacts", key);
    const record = await prisma.bugAttachment.create({
      data: {
        bug: { connect: { id: access.bug.id } },
        type,
        name: file.name || safeName,
        url,
        mimeType: file.type || null,
        sizeBytes: uploadPolicy.sizeBytes,
        checksumSha256: hash,
        metadata: {},
      },
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
    });

    return NextResponse.json(
      {
        ...record,
        sizeBytes: serializeSizeBytes(record.sizeBytes),
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { message: "Could not upload the attachment." },
      { status: 500 },
    );
  }
});
