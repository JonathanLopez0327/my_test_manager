import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ArtifactType, TestResultStatus } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { parseResultStatus, upsertRunMetrics } from "@/lib/test-runs";

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

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDuration(value?: number | string | null) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function parseArtifactType(value?: string | null) {
  if (!value) return "other";
  return ARTIFACT_TYPE_VALUES.includes(value as ArtifactType)
    ? (value as ArtifactType)
    : null;
}

export const GET = withAuth(null, async (req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, id, PERMISSIONS.TEST_RUN_ITEM_LIST);
  if (access.error) return access.error;

  const { searchParams } = new URL(req.url);
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseNumber(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const search = searchParams.get("search")?.trim();
  const status = parseResultStatus(searchParams.get("status")?.trim() ?? null);
  const testCaseId = searchParams.get("testCaseId")?.trim();
  const includeArtifacts = searchParams.get("includeArtifacts") === "true";

  const filters = [{ runId: id }] as Array<{
    runId: string;
    status?: TestResultStatus;
    testCaseId?: string;
    testCase?: {
      OR: Array<{
        title: { contains: string; mode: "insensitive" };
      } | {
        externalKey: { contains: string; mode: "insensitive" };
      }>;
    };
  }>;

  if (status) {
    filters.push({ runId: id, status });
  }
  if (testCaseId) {
    filters.push({ runId: id, testCaseId });
  }
  if (search) {
    filters.push({
      runId: id,
      testCase: {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { externalKey: { contains: search, mode: "insensitive" } },
        ],
      },
    });
  }

  const where = filters.length > 1 ? { AND: filters } : filters[0];

  const [items, total] = await prisma.$transaction([
    prisma.testRunItem.findMany({
      where,
      include: {
        testCase: {
          select: {
            id: true,
            title: true,
            externalKey: true,
          },
        },
        executedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        artifacts: includeArtifacts
          ? {
            select: {
              id: true,
              type: true,
              name: true,
              url: true,
              mimeType: true,
              checksumSha256: true,
              createdAt: true,
            },
          }
          : false,
      },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.testRunItem.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
  });
});

export const POST = withAuth(null, async (req, { userId, globalRoles }, routeCtx) => {
  const { id } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, id, PERMISSIONS.TEST_RUN_ITEM_UPDATE);
  if (access.error) return access.error;

  try {
    const body = (await req.json()) as {
      items?: Array<{
        testCaseId?: string;
        status?: TestResultStatus;
        durationMs?: number | string | null;
        executedById?: string | null;
        executedAt?: string | null;
        errorMessage?: string | null;
        stacktrace?: string | null;
        artifacts?: Array<{
          type?: ArtifactType;
          name?: string | null;
          url?: string;
          mimeType?: string | null;
          sizeBytes?: number | string | null;
          checksumSha256?: string | null;
          metadata?: unknown;
        }>;
      }>;
      recalculateMetrics?: boolean;
    };

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { message: "Se requiere al menos un item." },
        { status: 400 },
      );
    }

    const recalculateMetrics = body.recalculateMetrics !== false;

    const result = await prisma.$transaction(async (tx) => {
      const updatedItems = [];

      for (const item of body.items ?? []) {
        const testCaseId = item.testCaseId?.trim();
        if (!testCaseId) {
          throw new Error("test_case_required");
        }

        const status = parseResultStatus(item.status ?? null) ?? "not_run";
        const durationMs = parseDuration(item.durationMs);
        if (item.durationMs !== undefined && item.durationMs !== null && durationMs === null) {
          throw new Error("duration_invalid");
        }

        const executedAt = parseDate(item.executedAt ?? null);
        if (item.executedAt && !executedAt) {
          throw new Error("executed_at_invalid");
        }

        const upserted = await tx.testRunItem.upsert({
          where: {
            runId_testCaseId: {
              runId: id,
              testCaseId,
            },
          },
          update: {
            status,
            durationMs,
            executedById: item.executedById?.trim() || null,
            executedAt,
            errorMessage: item.errorMessage?.trim() || null,
            stacktrace: item.stacktrace?.trim() || null,
          },
          create: {
            runId: id,
            testCaseId,
            status,
            durationMs,
            executedById: item.executedById?.trim() || null,
            executedAt,
            errorMessage: item.errorMessage?.trim() || null,
            stacktrace: item.stacktrace?.trim() || null,
          },
        });

        if (item.artifacts && item.artifacts.length > 0) {
          const artifactData = item.artifacts.map((artifact) => {
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
              runItemId: upserted.id,
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

          await tx.testRunArtifact.createMany({
            data: artifactData,
          });
        }

        updatedItems.push(upserted);
      }

      const metrics = recalculateMetrics
        ? await upsertRunMetrics(tx, id)
        : null;

      return { updatedItems, metrics };
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron actualizar los items.";
    const errorMap: Record<string, string> = {
      test_case_required: "El testCaseId es requerido.",
      duration_invalid: "Duración inválida.",
      executed_at_invalid: "Fecha de ejecución inválida.",
      artifact_type_invalid: "Tipo de artefacto inválido.",
      artifact_url_required: "El artefacto requiere URL.",
      artifact_size_invalid: "Tamaño de artefacto inválido.",
    };

    if (message in errorMap) {
      return NextResponse.json({ message: errorMap[message] }, { status: 400 });
    }

    return NextResponse.json(
      { message: "No se pudieron actualizar los items." },
      { status: 500 },
    );
  }
});
