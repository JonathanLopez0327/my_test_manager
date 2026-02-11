import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ArtifactType } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { getPresignedUrl, getS3Config } from "@/lib/s3";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ARTIFACT_TYPE_VALUES: ArtifactType[] = [
  "screenshot",
  "video",
  "log",
  "report",
  "link",
  "other",
];

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArtifactType(value?: string | null) {
  if (!value) return null;
  return ARTIFACT_TYPE_VALUES.includes(value as ArtifactType)
    ? (value as ArtifactType)
    : null;
}

export const GET = withAuth(null, async (req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, id, PERMISSIONS.ARTIFACT_LIST);
  if (access.error) return access.error;

  const { searchParams } = new URL(req.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const runItemId = searchParams.get("runItemId")?.trim();
  const type = parseArtifactType(searchParams.get("type")?.trim() ?? null);

  if (searchParams.get("type") && !type) {
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

  const filters = [{ runId: id }] as Array<{
    runId: string;
    runItemId?: string;
    type?: ArtifactType;
  }>;

  if (runItemId) {
    filters.push({ runId: id, runItemId });
  }
  if (type) {
    filters.push({ runId: id, type });
  }

  const where = filters.length > 1 ? { AND: filters } : filters[0];

  const [items, total] = await prisma.$transaction([
    prisma.testRunArtifact.findMany({
      where,
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
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.testRunArtifact.count({ where }),
  ]);

  // Sign URLs
  const { bucket, publicUrl } = getS3Config();
  const bucketPrefix = `${publicUrl.replace(/\/$/, "")}/${bucket}/`;

  console.log("Signing artifacts...", { bucketPrefix, count: items.length });

  const signedItems = await Promise.all(
    items.map(async (item) => {
      if (item.url.startsWith(bucketPrefix)) {
        try {
          const encodedKey = item.url.slice(bucketPrefix.length);
          const key = decodeURI(encodedKey);
          const signedUrl = await getPresignedUrl(key);
          return { ...item, url: signedUrl };
        } catch (err) {
          console.error("Failed to sign URL for artifact", item.id, err);
          return item;
        }
      }
      return item;
    }),
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

export const POST = withAuth(null, async (req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, id, PERMISSIONS.ARTIFACT_UPLOAD);
  if (access.error) return access.error;

  try {
    const body = (await req.json()) as {
      artifacts?: Array<{
        runItemId?: string | null;
        type?: ArtifactType;
        name?: string | null;
        url?: string;
        mimeType?: string | null;
        sizeBytes?: number | string | null;
        checksumSha256?: string | null;
        metadata?: unknown;
      }>;
    };

    if (!body.artifacts || body.artifacts.length === 0) {
      return NextResponse.json(
        { message: "Se requiere al menos un artefacto." },
        { status: 400 },
      );
    }

    const runItemIds = Array.from(
      new Set(
        body.artifacts
          .map((artifact) => artifact.runItemId?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (runItemIds.length > 0) {
      const existing = await prisma.testRunItem.findMany({
        where: { id: { in: runItemIds }, runId: id },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((item) => item.id));
      const invalid = runItemIds.find((itemId) => !existingIds.has(itemId));
      if (invalid) {
        return NextResponse.json(
          { message: "Uno o más items no pertenecen al run." },
          { status: 400 },
        );
      }
    }

    const artifactsData = body.artifacts.map((artifact) => {
      const type = parseArtifactType(artifact.type ?? null);
      if (!type) {
        throw new Error("artifact_type_invalid");
      }

      const url = artifact.url?.trim();
      if (!url) {
        throw new Error("artifact_url_required");
      }

      let sizeBytes: bigint | null = null;
      if (artifact.sizeBytes !== undefined && artifact.sizeBytes !== null) {
        const parsed = Number(artifact.sizeBytes);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error("artifact_size_invalid");
        }
        sizeBytes = BigInt(Math.round(parsed));
      }

      return {
        runId: id,
        runItemId: artifact.runItemId?.trim() || null,
        type,
        name: artifact.name?.trim() || null,
        url,
        mimeType: artifact.mimeType?.trim() || null,
        sizeBytes,
        checksumSha256: artifact.checksumSha256?.trim() || null,
        metadata:
          artifact.metadata && typeof artifact.metadata === "object"
            ? artifact.metadata
            : {},
      };
    });

    const created = await prisma.testRunArtifact.createMany({
      data: artifactsData,
    });

    return NextResponse.json({ count: created.count }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron crear los artefactos.";
    const errorMap: Record<string, string> = {
      artifact_type_invalid: "Tipo de artefacto inválido.",
      artifact_url_required: "El artefacto requiere URL.",
      artifact_size_invalid: "Tamaño de artefacto inválido.",
    };

    if (message in errorMap) {
      return NextResponse.json({ message: errorMap[message] }, { status: 400 });
    }

    return NextResponse.json(
      { message: "No se pudieron crear los artefactos." },
      { status: 500 },
    );
  }
});
