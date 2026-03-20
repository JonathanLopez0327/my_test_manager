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

function isMissingColumnError(error: unknown) {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "P2022"
  );
}

type GroupedArtifactResponseItem = {
  id: string;
  runId: string | null;
  runItemId: string | null;
  executionId: string | null;
  type: ArtifactType;
  name: string | null;
  url: string;
  mimeType: string | null;
  checksumSha256: string | null;
  sizeBytes: bigint | null;
  metadata: unknown;
  createdAt: Date;
};

type GroupedExecutionMeta = {
  attemptNumber?: number;
  status?: string;
  executedAt?: string;
};

function serializeSizeBytes(value: bigint | number | string | null | undefined) {
  if (typeof value !== "bigint") return value ?? null;
  if (value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  return value.toString();
}

function parseExecutionMeta(metadata: unknown): GroupedExecutionMeta {
  if (!metadata || typeof metadata !== "object") return {};
  const raw = metadata as Record<string, unknown>;
  const attemptRaw = raw.attemptNumber;
  const statusRaw = raw.status;
  const executedAtRaw = raw.completedAt ?? raw.executedAt;

  const attemptNumber = Number(attemptRaw);
  const parsedAttempt =
    Number.isInteger(attemptNumber) && attemptNumber > 0
      ? attemptNumber
      : undefined;
  const parsedStatus =
    typeof statusRaw === "string" && statusRaw.trim().length > 0
      ? statusRaw.trim()
      : undefined;
  const parsedExecutedAt =
    typeof executedAtRaw === "string" && executedAtRaw.trim().length > 0
      ? executedAtRaw.trim()
      : undefined;

  return {
    attemptNumber: parsedAttempt,
    status: parsedStatus,
    executedAt: parsedExecutedAt,
  };
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
  const groupBy = searchParams.get("groupBy")?.trim();
  const groupByTest = groupBy === "test";

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

  let items: Array<{
    id: string;
    runId: string | null;
    runItemId: string | null;
    executionId: string | null;
    type: ArtifactType;
    name: string | null;
    url: string;
    mimeType: string | null;
    checksumSha256: string | null;
    sizeBytes: bigint | null;
    metadata: unknown;
    createdAt: Date;
  }> = [];
  let total = 0;

  try {
    const result = await prisma.$transaction([
      prisma.testRunArtifact.findMany({
        where,
        select: {
          id: true,
          runId: true,
          runItemId: true,
          executionId: true,
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
      prisma.testRunArtifact.count({ where }),
    ]);
    items = result[0];
    total = result[1];
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }

    // Legacy fallback: allows listing artifacts before execution-history migration is applied.
    const legacyResult = await prisma.$transaction([
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
          sizeBytes: true,
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

    items = legacyResult[0].map((item) => ({
      ...item,
      executionId: null,
    }));
    total = legacyResult[1];
  }

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
  const serializedItems = filteredItems.map((item) => ({
    ...item,
    sizeBytes: serializeSizeBytes(item.sizeBytes),
  }));

  const filteredTotal = includeExecutionState ? total : filteredItems.length;

  if (groupByTest) {
    const runItemIds = Array.from(
      new Set(
        serializedItems
          .map((item) => item.runItemId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const executionIds = Array.from(
      new Set(
        serializedItems
          .map((item) => item.executionId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const [runItems, executions] = await Promise.all([
      runItemIds.length > 0
        ? prisma.testRunItem.findMany({
          where: { id: { in: runItemIds }, runId: id },
          select: {
            id: true,
            testCase: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        })
        : Promise.resolve([]),
      executionIds.length > 0
        ? prisma.testRunItemExecution.findMany({
          where: { id: { in: executionIds } },
          select: {
            id: true,
            attemptNumber: true,
            status: true,
            completedAt: true,
          },
        })
        : Promise.resolve([]),
    ]);

    const runItemById = new Map(runItems.map((item) => [item.id, item]));
    const executionById = new Map(executions.map((execution) => [execution.id, execution]));
    const groupedByTest = new Map<string, {
      testId: string;
      testName: string;
      totalArtifacts: number;
      lastArtifactAt: string;
      executions: Map<string, {
        runId: string | null;
        runLabel: string;
        runNumber: number | null;
        status: string | null;
        executedAt: string | null;
        artifacts: Array<
          Omit<GroupedArtifactResponseItem, "sizeBytes"> & {
            sizeBytes: number | string | null;
          }
        >;
      }>;
    }>();

    for (const artifact of serializedItems) {
      const runItem = artifact.runItemId ? runItemById.get(artifact.runItemId) : null;
      const testId = runItem?.testCase.id ?? "__run_level__";
      const testName = runItem?.testCase.title ?? "Run-level artifacts";
      const executionMeta = parseExecutionMeta(artifact.metadata);
      const execution = artifact.executionId
        ? executionById.get(artifact.executionId)
        : null;
      const executionKey =
        artifact.executionId
        ?? `legacy-${artifact.runItemId ?? "run"}-${artifact.id}`;
      const executionNumber = execution?.attemptNumber ?? executionMeta.attemptNumber ?? null;
      const executionStatus = execution?.status ?? executionMeta.status ?? null;
      const executedAt = execution?.completedAt?.toISOString()
        ?? executionMeta.executedAt
        ?? artifact.createdAt.toISOString();
      const runLabel = executionNumber
        ? `Execution #${executionNumber}`
        : artifact.executionId
          ? `Execution ${artifact.executionId.slice(0, 8)}`
          : "Without execution";

      let group = groupedByTest.get(testId);
      if (!group) {
        group = {
          testId,
          testName,
          totalArtifacts: 0,
          lastArtifactAt: artifact.createdAt.toISOString(),
          executions: new Map(),
        };
        groupedByTest.set(testId, group);
      }

      group.totalArtifacts += 1;
      if (artifact.createdAt.toISOString() > group.lastArtifactAt) {
        group.lastArtifactAt = artifact.createdAt.toISOString();
      }

      let executionGroup = group.executions.get(executionKey);
      if (!executionGroup) {
        executionGroup = {
          runId: artifact.executionId,
          runLabel,
          runNumber: executionNumber,
          status: executionStatus,
          executedAt,
          artifacts: [],
        };
        group.executions.set(executionKey, executionGroup);
      }

      executionGroup.artifacts.push(artifact);
    }

    const groups = Array.from(groupedByTest.values())
      .map((group) => ({
        testId: group.testId,
        testName: group.testName,
        totalArtifacts: group.totalArtifacts,
        lastArtifactAt: group.lastArtifactAt,
        executions: Array.from(group.executions.values())
          .map((execution) => ({
            runId: execution.runId,
            runLabel: execution.runLabel,
            runNumber: execution.runNumber,
            status: execution.status,
            executedAt: execution.executedAt,
            artifacts: execution.artifacts,
          }))
          .sort((a, b) => {
            const aTime = a.executedAt ? new Date(a.executedAt).getTime() : 0;
            const bTime = b.executedAt ? new Date(b.executedAt).getTime() : 0;
            return bTime - aTime;
          }),
      }))
      .filter((group) => group.totalArtifacts > 0)
      .sort(
        (a, b) =>
          new Date(b.lastArtifactAt).getTime() - new Date(a.lastArtifactAt).getTime(),
      );

    return NextResponse.json(
      {
        groups,
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
  }

  return NextResponse.json(
    {
      items: serializedItems,
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
        executionId?: string | null;
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
        executionId: artifact.executionId?.trim() || null,
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
