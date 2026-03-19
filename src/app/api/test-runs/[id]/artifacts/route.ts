import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ArtifactType } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { getPresignedUrl, getS3Config } from "@/lib/s3";
import { validateArtifactUploadPolicy } from "@/lib/artifact-upload-policy";

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

export const GET = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, id, PERMISSIONS.ARTIFACT_LIST, activeOrganizationId, organizationRole);
  if (access.error) return access.error;

  const { searchParams } = new URL(req.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const runItemId = searchParams.get("runItemId")?.trim();
  const type = parseArtifactType(searchParams.get("type")?.trim() ?? null);
  const includeExecutionState = searchParams.get("includeExecutionState") === "true";

  if (searchParams.get("type") && !type) {
    return NextResponse.json(
      { message: "Invalid artifact type." },
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
        { message: "The item does not belong to this run." },
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
  const { bucket, endpoint } = getS3Config("artifacts");
  const base = (process.env.S3_PUBLIC_URL ?? endpoint).replace(/\/$/, "");
  const bucketPrefix = `${base}/${bucket}/`;

  console.log("Signing artifacts...", { bucketPrefix, count: items.length });

  const signedItems = await Promise.all(
    items.map(async (item) => {
      if (item.url.startsWith(bucketPrefix)) {
        try {
          const encodedKey = item.url.slice(bucketPrefix.length);
          const key = decodeURI(encodedKey);
          const signedUrl = await getPresignedUrl("artifacts", key);
          return { ...item, url: signedUrl };
        } catch (err) {
          console.error("Failed to sign URL for artifact", item.id, err);
          return item;
        }
      }
      return item;
    }),
  );

  const filteredItems = signedItems.filter((item) => {
    if (includeExecutionState) return true;
    const metadata = item.metadata;
    if (!metadata || typeof metadata !== "object") return true;
    const kind = (metadata as Record<string, unknown>).kind;
    return kind !== "execution_state";
  });

  const filteredTotal = includeExecutionState ? total : filteredItems.length;

  return NextResponse.json(
    {
      items: filteredItems,
      total: filteredTotal,
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

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, id, PERMISSIONS.ARTIFACT_UPLOAD, activeOrganizationId, organizationRole);
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
        { message: "At least one artifact is required." },
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
          { message: "One or more items do not belong to this run." },
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

      const uploadPolicy = validateArtifactUploadPolicy({
        type,
        sizeBytes: artifact.sizeBytes,
        requirePositiveSize: false,
      });

      if (!uploadPolicy.ok) {
        throw new Error(uploadPolicy.code);
      }

      return {
        runId: id,
        runItemId: artifact.runItemId?.trim() || null,
        type,
        name: artifact.name?.trim() || null,
        url,
        mimeType: artifact.mimeType?.trim() || null,
        sizeBytes: uploadPolicy.sizeBytes,
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
        : "Could not create artifacts.";
    const errorMap: Record<string, string> = {
      artifact_type_invalid: "Invalid artifact type.",
      artifact_type_blocked_beta: "Video uploads are disabled in beta.",
      artifact_url_required: "El artefacto requiere URL.",
      artifact_size_invalid: "Invalid artifact size.",
      artifact_size_limit_exceeded: "Artifact exceeds the 10 MB limit.",
    };

    if (message in errorMap) {
      return NextResponse.json({ message: errorMap[message] }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Could not create artifacts." },
      { status: 500 },
    );
  }
});
