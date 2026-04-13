import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { ArtifactType, Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { buildS3ObjectUrl, getS3Client, getS3Config } from "@/lib/s3";
import { validateArtifactUploadPolicy } from "@/lib/artifact-upload-policy";

const ARTIFACT_TYPE_VALUES: ArtifactType[] = [
  "screenshot",
  "video",
  "log",
  "report",
  "link",
  "other",
];

function parseArtifactType(value?: string | null) {
  if (!value) return "other";
  return ARTIFACT_TYPE_VALUES.includes(value as ArtifactType)
    ? (value as ArtifactType)
    : null;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isLegacyExecutionSchemaError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2022";
}

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, id, PERMISSIONS.ARTIFACT_UPLOAD, activeOrganizationId, organizationRole);
  if (access.error) return access.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    let runItemId = String(formData.get("runItemId") ?? "").trim() || null;
    const executionId = String(formData.get("executionId") ?? "").trim() || null;
    const type = parseArtifactType(
      String(formData.get("type") ?? "").trim() || null,
    );
    const name = String(formData.get("name") ?? "").trim() || null;
    const metadataRaw = String(formData.get("metadata") ?? "").trim();

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { message: "File is required." },
        { status: 400 },
      );
    }

    if (!type) {
      return NextResponse.json(
        { message: "Invalid artifact type." },
        { status: 400 },
      );
    }

    let metadata: Record<string, unknown> = {};
    if (metadataRaw) {
      try {
        const parsed = JSON.parse(metadataRaw) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return NextResponse.json(
            { message: "Invalid artifact metadata." },
            { status: 400 },
          );
        }
        metadata = parsed as Record<string, unknown>;
      } catch {
        return NextResponse.json(
          { message: "Invalid artifact metadata." },
          { status: 400 },
        );
      }
    }

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

    const scope = typeof metadata.scope === "string" ? metadata.scope : null;
    const requiresImage =
      type === "screenshot" || scope === "general" || scope === "step";
    if (requiresImage && !(file.type || "").toLowerCase().startsWith("image/")) {
      return NextResponse.json(
        { message: "Only image files are allowed for execution evidence." },
        { status: 400 },
      );
    }

    let generatedName = name;

    if (executionId) {
      try {
        const execution = await prisma.testRunItemExecution.findFirst({
          where: {
            id: executionId,
            runItem: { runId: id },
          },
          select: {
            id: true,
            runItemId: true,
            runItem: {
              select: {
                testCase: {
                  select: {
                    title: true,
                    externalKey: true,
                  },
                },
              },
            },
          },
        });
        if (!execution) {
          return NextResponse.json(
            { message: "Execution does not belong to this run." },
            { status: 400 },
          );
        }
        if (runItemId && runItemId !== execution.runItemId) {
          return NextResponse.json(
            { message: "runItemId does not match executionId." },
            { status: 400 },
          );
        }
        runItemId = execution.runItemId;
        const caseName = execution.runItem.testCase.externalKey
          ? `${execution.runItem.testCase.externalKey} ${execution.runItem.testCase.title}`
          : execution.runItem.testCase.title;
        generatedName = `${caseName} - ${type} - ${file.name}`;
      } catch (error) {
        if (!isLegacyExecutionSchemaError(error)) throw error;
        // Legacy schema fallback: execution linkage is unavailable until migration is applied.
      }
    } else if (runItemId) {
      const belongs = await prisma.testRunItem.findFirst({
        where: { id: runItemId, runId: id },
        select: {
          id: true,
          testCase: {
            select: {
              title: true,
              externalKey: true,
            },
          },
        },
      });

      if (!belongs) {
        return NextResponse.json(
          { message: "The item does not belong to this run." },
          { status: 400 },
        );
      }

      const caseName = belongs.testCase.externalKey
        ? `${belongs.testCase.externalKey} ${belongs.testCase.title}`
        : belongs.testCase.title;
      generatedName = `${caseName} - ${type} - ${file.name}`;
    } else {
      generatedName = `Run - ${type} - ${file.name}`;
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha256").update(fileBuffer).digest("hex");
    const safeName = sanitizeFileName(file.name || "artifact");
    const key = `test-runs/${id}/${runItemId ?? "run"}/${Date.now()}-${safeName}`;

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

    let record;
    try {
      record = await prisma.testRunArtifact.create({
        data: {
          run: { connect: { id } },
          ...(runItemId ? { runItem: { connect: { id: runItemId } } } : {}),
          ...(executionId ? { execution: { connect: { id: executionId } } } : {}),
          type,
          name: generatedName,
          url,
          mimeType: file.type || null,
          sizeBytes: uploadPolicy.sizeBytes,
          checksumSha256: hash,
          metadata: metadata as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          runId: true,
          runItemId: true,
          type: true,
          name: true,
          url: true,
          mimeType: true,
          checksumSha256: true,
          metadata: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (!isLegacyExecutionSchemaError(error)) throw error;

      // Legacy schema fallback: write artifact without execution linkage.
      record = await prisma.testRunArtifact.create({
        data: {
          run: { connect: { id } },
          ...(runItemId ? { runItem: { connect: { id: runItemId } } } : {}),
          type,
          name: generatedName,
          url,
          mimeType: file.type || null,
          sizeBytes: uploadPolicy.sizeBytes,
          checksumSha256: hash,
          metadata: metadata as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          runId: true,
          runItemId: true,
          type: true,
          name: true,
          url: true,
          mimeType: true,
          checksumSha256: true,
          metadata: true,
          createdAt: true,
        },
      });
    }

    return NextResponse.json(record, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "Could not upload the artifact." },
      { status: 500 },
    );
  }
});
