import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createHash } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { ArtifactType } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import {
  getGlobalRoles,
  getProjectRole,
  hasProjectPermission,
  isReadOnlyGlobal,
  isSuperAdmin,
} from "@/lib/permissions";
import { buildS3ObjectUrl, getS3Client, getS3Config } from "@/lib/s3";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

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

async function requireRunAccess(userId: string, runId: string) {
  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    select: { id: true, projectId: true },
  });

  if (!run) {
    return {
      error: NextResponse.json(
        { message: "Run no encontrado." },
        { status: 404 },
      ),
    };
  }

  const globalRoles = await getGlobalRoles(userId);
  if (isSuperAdmin(globalRoles)) {
    return { run };
  }

  if (isReadOnlyGlobal(globalRoles)) {
    return {
      error: NextResponse.json({ message: "Solo lectura." }, { status: 403 }),
    };
  }

  const role = await getProjectRole(userId, run.projectId);
  if (!hasProjectPermission(role, "editor")) {
    return {
      error: NextResponse.json(
        { message: "No tienes permisos en este proyecto." },
        { status: 403 },
      ),
    };
  }

  return { run };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const access = await requireRunAccess(session.user.id, id);
  if (access.error) return access.error;

  try {
    const formData = await request.formData();
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

    if (runItemId) {
      const belongs = await prisma.testRunItem.findFirst({
        where: { id: runItemId, runId: id },
        select: { id: true },
      });
      if (!belongs) {
        return NextResponse.json(
          { message: "El item no pertenece al run." },
          { status: 400 },
        );
      }
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
        name,
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
}
