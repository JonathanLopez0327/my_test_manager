import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { ArtifactType } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { buildS3ObjectUrl, getS3Client, getS3Config } from "@/lib/s3";

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

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, id, PERMISSIONS.ARTIFACT_UPLOAD, activeOrganizationId, organizationRole);
  if (access.error) return access.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const runItemId = String(formData.get("runItemId") ?? "").trim() || null;
    const type = parseArtifactType(
      String(formData.get("type") ?? "").trim() || null,
    );
    const name = String(formData.get("name") ?? "").trim() || null;

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { message: "Archivo requerido." },
        { status: 400 },
      );
    }

    if (!type) {
      return NextResponse.json(
        { message: "Tipo de artefacto inválido." },
        { status: 400 },
      );
    }

    let generatedName = name;

    if (runItemId) {
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
          { message: "El item no pertenece al run." },
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

    const { bucket } = getS3Config();
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: file.type || "application/octet-stream",
      }),
    );

    const url = buildS3ObjectUrl(bucket, key);

    const record = await prisma.testRunArtifact.create({
      data: {
        runId: id,
        runItemId,
        type,
        name: generatedName,
        url,
        mimeType: file.type || null,
        sizeBytes: BigInt(file.size),
        checksumSha256: hash,
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
        createdAt: true,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: "No se pudo subir el artefacto." },
      { status: 500 },
    );
  }
});
