import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ArtifactType, TestCaseStyle, TestResultStatus } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { parseResultStatus, upsertRunMetrics } from "@/lib/test-runs";
import { ensureRunMutable } from "@/lib/auth/ensure-run-mutable";

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

function isExecutionEvidenceMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return false;
  const raw = metadata as Record<string, unknown>;
  return raw.kind === "execution_evidence";
}

function isExecutionStateMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return false;
  const raw = metadata as Record<string, unknown>;
  return raw.kind === "execution_state";
}

type StepSnapshot = {
  stepTextSnapshot: string;
  expectedSnapshot: string | null;
};

function parseStepSnapshots(style: TestCaseStyle, steps: unknown): StepSnapshot[] {
  if (!steps) return [];

  if (style === "step_by_step" && Array.isArray(steps)) {
    return steps
      .map((entry) => {
        if (typeof entry === "string") return { stepTextSnapshot: entry, expectedSnapshot: null };
        if (!entry || typeof entry !== "object") return null;
        const value = entry as { step?: unknown; expectedResult?: unknown };
        return {
          stepTextSnapshot: typeof value.step === "string" ? value.step : "",
          expectedSnapshot: typeof value.expectedResult === "string" ? value.expectedResult : null,
        };
      })
      .filter((entry): entry is StepSnapshot => Boolean(entry?.stepTextSnapshot?.trim()));
  }

  if (style === "gherkin" && Array.isArray(steps)) {
    return steps.flatMap((entry): StepSnapshot[] => {
      if (!entry || typeof entry !== "object") return [];
      const value = entry as { keyword?: unknown; text?: unknown };
      const keyword = typeof value.keyword === "string" ? value.keyword : "";
      const text = typeof value.text === "string" ? value.text : "";
      const line = `${keyword} ${text}`.trim();
      return line ? [{ stepTextSnapshot: line, expectedSnapshot: null }] : [];
    });
  }

  if (style === "data_driven" && typeof steps === "object" && steps !== null) {
    const value = steps as { template?: unknown };
    if (Array.isArray(value.template)) {
      return value.template.flatMap((entry): StepSnapshot[] => {
        if (!entry || typeof entry !== "object") return [];
        const row = entry as { keyword?: unknown; text?: unknown };
        const keyword = typeof row.keyword === "string" ? row.keyword : "";
        const text = typeof row.text === "string" ? row.text : "";
        const line = `${keyword} ${text}`.trim();
        return line ? [{ stepTextSnapshot: line, expectedSnapshot: null }] : [];
      });
    }
  }

  if (style === "api" && typeof steps === "object" && steps !== null) {
    const value = steps as {
      request?: { method?: unknown; endpoint?: unknown };
      expectedResponse?: { status?: unknown };
    };
    const method = typeof value.request?.method === "string" ? value.request.method : "REQUEST";
    const endpoint = typeof value.request?.endpoint === "string" ? value.request.endpoint : "/";
    const status = typeof value.expectedResponse?.status === "string" ? value.expectedResponse.status : "N/A";
    return [{ stepTextSnapshot: `${method} ${endpoint}`, expectedSnapshot: `Expected status ${status}` }];
  }

  if (Array.isArray(steps)) {
    return steps.flatMap((entry): StepSnapshot[] =>
      typeof entry === "string" && entry.trim()
        ? [{ stepTextSnapshot: entry, expectedSnapshot: null }]
        : [],
    );
  }

  return [];
}

export const GET = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  try {
    const { id } = await routeCtx.params;
    const access = await requireRunPermission(userId, globalRoles, id, PERMISSIONS.TEST_RUN_ITEM_LIST, activeOrganizationId, organizationRole);
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

    let items: unknown[] = [];
    let total = 0;

    try {
      const result = await prisma.$transaction([
        prisma.testRunItem.findMany({
          where,
          include: {
            testCase: {
              select: {
                id: true,
                title: true,
                externalKey: true,
                preconditions: true,
                steps: true,
                style: true,
              },
            },
            executedBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            ...(includeArtifacts
              ? {
                artifacts: {
                  select: {
                    id: true,
                    type: true,
                    name: true,
                    url: true,
                    mimeType: true,
                    checksumSha256: true,
                    createdAt: true,
                  },
                },
              }
              : {}),
            currentExecution: {
              select: {
                id: true,
                attemptNumber: true,
              },
            },
            _count: {
              select: {
                executions: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.testRunItem.count({ where }),
      ]);
      items = result[0];
      total = result[1];
    } catch {
      // Legacy fallback: allows listing run items before execution-history migration is applied.
      const legacyResult = await prisma.$transaction([
        prisma.testRunItem.findMany({
          where,
          select: {
            id: true,
            runId: true,
            testCaseId: true,
            status: true,
            durationMs: true,
            executedById: true,
            executedAt: true,
            errorMessage: true,
            stacktrace: true,
            createdAt: true,
            testCase: {
              select: {
                id: true,
                title: true,
                externalKey: true,
                preconditions: true,
                steps: true,
                style: true,
              },
            },
            executedBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            ...(includeArtifacts
              ? {
                artifacts: {
                  select: {
                    id: true,
                    type: true,
                    name: true,
                    url: true,
                    mimeType: true,
                    checksumSha256: true,
                    createdAt: true,
                  },
                },
              }
              : {}),
          },
          orderBy: { createdAt: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.testRunItem.count({ where }),
      ]);

      const legacyRunItemIds = legacyResult[0].map((item) => item.id);
      const executionStateAttemptsByItemId = new Map<string, Set<number>>();
      if (legacyRunItemIds.length > 0) {
        const stateArtifacts = await prisma.testRunArtifact.findMany({
          where: {
            runId: id,
            runItemId: { in: legacyRunItemIds },
          },
          select: {
            runItemId: true,
            metadata: true,
          },
        });

        for (const artifact of stateArtifacts) {
          if (!artifact.runItemId) continue;
          if (!artifact.metadata || typeof artifact.metadata !== "object") continue;
          const raw = artifact.metadata as Record<string, unknown>;
          if (raw.kind !== "execution_state") continue;
          const attemptNumber = Number(raw.attemptNumber);
          if (!Number.isInteger(attemptNumber) || attemptNumber <= 0) continue;
          const attempts = executionStateAttemptsByItemId.get(artifact.runItemId) ?? new Set<number>();
          attempts.add(attemptNumber);
          executionStateAttemptsByItemId.set(artifact.runItemId, attempts);
        }
      }

      items = legacyResult[0].map((item) => {
        const hasLegacyExecution =
          item.status !== "not_run"
          || Boolean(item.executedAt)
          || item.durationMs !== null;
        const executionStateCount = executionStateAttemptsByItemId.get(item.id)?.size ?? 0;
        const totalExecutionCount = (hasLegacyExecution ? 1 : 0) + executionStateCount;
        return {
          ...item,
          currentExecution: null,
          _count: { executions: totalExecutionCount },
        };
      });
      total = legacyResult[1];
    }

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
    });
  } catch {
    return NextResponse.json(
      { message: "Could not load run items." },
      { status: 500 },
    );
  }
});

export const POST = withAuth(null, async (req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
  const { id } = await routeCtx.params;
  const access = await requireRunPermission(userId, globalRoles, id, PERMISSIONS.TEST_RUN_ITEM_UPDATE, activeOrganizationId, organizationRole);
  if (access.error) return access.error;
  const mutableError = await ensureRunMutable(id);
  if (mutableError) return mutableError;

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
        { message: "At least one item is required." },
        { status: 400 },
      );
    }

    const recalculateMetrics = body.recalculateMetrics !== false;

    const runLegacyUpsert = async () => prisma.$transaction(async (tx) => {
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

        const executedById = item.executedById?.trim() || null;
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
            ...(executedById
              ? { executedBy: { connect: { id: executedById } } }
              : { executedBy: { disconnect: true } }),
            executedAt,
            errorMessage: item.errorMessage?.trim() || null,
            stacktrace: item.stacktrace?.trim() || null,
          },
          create: {
            run: { connect: { id } },
            testCase: { connect: { id: testCaseId } },
            status,
            durationMs,
            ...(executedById ? { executedBy: { connect: { id: executedById } } } : {}),
            executedAt,
            errorMessage: item.errorMessage?.trim() || null,
            stacktrace: item.stacktrace?.trim() || null,
          },
          select: {
            id: true,
            runId: true,
            testCaseId: true,
            status: true,
            durationMs: true,
            executedById: true,
            executedAt: true,
            errorMessage: true,
            stacktrace: true,
            createdAt: true,
          },
        });

        if (status === "not_run") {
          const existingArtifacts = await tx.testRunArtifact.findMany({
            where: {
              runId: id,
              runItemId: upserted.id,
            },
            select: {
              id: true,
              metadata: true,
            },
          });
          const executionArtifactIds = existingArtifacts
            .filter(
              (artifact) =>
                isExecutionEvidenceMetadata(artifact.metadata)
                || isExecutionStateMetadata(artifact.metadata),
            )
            .map((artifact) => artifact.id);
          if (executionArtifactIds.length > 0) {
            await tx.testRunArtifact.deleteMany({
              where: {
                id: { in: executionArtifactIds },
              },
            });
          }
        }

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

    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
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

        const executedById = item.executedById?.trim() || null;
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
            ...(executedById
              ? { executedBy: { connect: { id: executedById } } }
              : { executedBy: { disconnect: true } }),
            executedAt,
            errorMessage: item.errorMessage?.trim() || null,
            stacktrace: item.stacktrace?.trim() || null,
          },
          create: {
            run: { connect: { id } },
            testCase: { connect: { id: testCaseId } },
            status,
            durationMs,
            ...(executedById ? { executedBy: { connect: { id: executedById } } } : {}),
            executedAt,
            errorMessage: item.errorMessage?.trim() || null,
            stacktrace: item.stacktrace?.trim() || null,
          },
          select: {
            id: true,
            runId: true,
            testCaseId: true,
            status: true,
            durationMs: true,
            executedById: true,
            executedAt: true,
            errorMessage: true,
            stacktrace: true,
            createdAt: true,
          },
        });

        if (status === "not_run") {
          const existingArtifacts = await tx.testRunArtifact.findMany({
            where: {
              runId: id,
              runItemId: upserted.id,
            },
            select: {
              id: true,
              executionId: true,
              metadata: true,
            },
          });
          const executionArtifactIds = existingArtifacts
            .filter(
              (artifact) =>
                Boolean(artifact.executionId)
                || isExecutionEvidenceMetadata(artifact.metadata)
                || isExecutionStateMetadata(artifact.metadata),
            )
            .map((artifact) => artifact.id);
          if (executionArtifactIds.length > 0) {
            await tx.testRunArtifact.deleteMany({
              where: {
                id: { in: executionArtifactIds },
              },
            });
          }

          await tx.testRunItemExecutionStepResult.deleteMany({
            where: {
              execution: {
                runItemId: upserted.id,
              },
            },
          });
          await tx.testRunItemExecution.deleteMany({
            where: {
              runItemId: upserted.id,
            },
          });
          await tx.testRunItem.update({
            where: { id: upserted.id },
            data: { currentExecution: { disconnect: true } },
          });

          updatedItems.push(upserted);
          continue;
        }

        const runItemWithCase = await tx.testRunItem.findUnique({
          where: { id: upserted.id },
          select: {
            currentExecutionId: true,
            testCase: {
              select: {
                style: true,
                steps: true,
              },
            },
            executions: {
              orderBy: [{ attemptNumber: "desc" }],
              take: 1,
              select: {
                attemptNumber: true,
              },
            },
          },
        });
        let resolvedExecutionId = runItemWithCase?.currentExecutionId ?? null;

        if (runItemWithCase?.currentExecutionId) {
          const execExecutedById = item.executedById?.trim() || null;
          await tx.testRunItemExecution.update({
            where: { id: runItemWithCase.currentExecutionId },
            data: {
              status,
              durationMs,
              ...(execExecutedById
                ? { executedBy: { connect: { id: execExecutedById } } }
                : { executedBy: { disconnect: true } }),
              startedAt: executedAt ?? undefined,
              completedAt: status === "in_progress" ? null : (executedAt ?? new Date()),
              errorMessage: item.errorMessage?.trim() || null,
            },
          });
        } else if (runItemWithCase) {
          const nextAttempt = (runItemWithCase.executions[0]?.attemptNumber ?? 0) + 1;
          const createExecById = item.executedById?.trim() || null;
          const createdExecution = await tx.testRunItemExecution.create({
            data: {
              runItem: { connect: { id: upserted.id } },
              attemptNumber: nextAttempt,
              status,
              durationMs,
              startedAt: executedAt ?? new Date(),
              completedAt: status === "in_progress" ? null : (executedAt ?? new Date()),
              ...(createExecById ? { executedBy: { connect: { id: createExecById } } } : {}),
              errorMessage: item.errorMessage?.trim() || null,
            },
            select: { id: true },
          });

          const stepSnapshots = parseStepSnapshots(runItemWithCase.testCase.style, runItemWithCase.testCase.steps);
          if (stepSnapshots.length > 0) {
            await tx.testRunItemExecutionStepResult.createMany({
              data: stepSnapshots.map((step, index) => ({
                executionId: createdExecution.id,
                stepIndex: index,
                stepTextSnapshot: step.stepTextSnapshot,
                expectedSnapshot: step.expectedSnapshot,
                status: "not_run",
              })),
            });
          }

          await tx.testRunItem.update({
            where: { id: upserted.id },
            data: { currentExecution: { connect: { id: createdExecution.id } } },
          });
          resolvedExecutionId = createdExecution.id;
        }

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
              executionId: resolvedExecutionId,
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
    } catch {
      // Compatibility fallback while some environments are still on legacy schema.
      result = await runLegacyUpsert();
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not update items.";
    const errorMap: Record<string, string> = {
      test_case_required: "El testCaseId es requerido.",
      duration_invalid: "Invalid duration.",
      executed_at_invalid: "Invalid execution date.",
      artifact_type_invalid: "Invalid artifact type.",
      artifact_url_required: "El artefacto requiere URL.",
      artifact_size_invalid: "Invalid artifact size.",
    };

    if (message in errorMap) {
      return NextResponse.json({ message: errorMap[message] }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Could not update items." },
      { status: 500 },
    );
  }
});


