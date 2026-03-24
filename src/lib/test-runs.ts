import { Prisma, PrismaClient, TestResultStatus } from "@/generated/prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

const RESULT_STATUS_VALUES: TestResultStatus[] = [
  "passed",
  "failed",
  "skipped",
  "blocked",
  "not_run",
  "in_progress",
];

export type RunMetricsData = {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  blocked: number;
  notRun: number;
  passRate: Prisma.Decimal;
  durationMs: bigint | null;
};

export type RunMetricsResponse = {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  blocked: number;
  notRun: number;
  passRate: string;
  durationMs: string | null;
  createdAt: string;
};

function toRunMetricsResponse(data: RunMetricsData, createdAt: Date) {
  return {
    total: data.total,
    passed: data.passed,
    failed: data.failed,
    skipped: data.skipped,
    blocked: data.blocked,
    notRun: data.notRun,
    passRate: data.passRate.toFixed(2),
    durationMs: data.durationMs ? data.durationMs.toString() : null,
    createdAt: createdAt.toISOString(),
  };
}

export async function computeRunMetrics(
  db: DbClient,
  runId: string,
): Promise<RunMetricsData> {
  const [executionGrouped, durationAgg, executionAttemptsByRunItem, notRunItemsWithoutExecutions, legacyExecutionStateArtifacts] = await Promise.all([
    db.testRunItemExecution.groupBy({
      by: ["status"],
      where: {
        runItem: { runId },
      },
      _count: {
        _all: true,
      },
    }),
    db.testRunItemExecution.aggregate({
      where: {
        runItem: { runId },
      },
      _sum: { durationMs: true },
    }),
    db.testRunItemExecution.groupBy({
      by: ["runItemId"],
      where: {
        runItem: { runId },
      },
      _max: {
        attemptNumber: true,
      },
    }),
    db.testRunItem.findMany({
      where: {
        runId,
        status: "not_run",
        executions: { none: {} },
      },
      select: { id: true },
    }),
    db.testRunArtifact.findMany({
      where: {
        runId,
        runItemId: { not: null },
        executionId: null,
      },
      select: {
        runItemId: true,
        metadata: true,
      },
    }),
  ]);

  const counts: Record<TestResultStatus, number> = {
    passed: 0,
    failed: 0,
    skipped: 0,
    blocked: 0,
    not_run: 0,
    in_progress: 0,
  };

  for (const item of executionGrouped) {
    counts[item.status] = item._count._all;
  }

  const maxAttemptByRunItem = new Map<string, number>();
  for (const item of executionAttemptsByRunItem) {
    if (!item._max.attemptNumber) continue;
    maxAttemptByRunItem.set(item.runItemId, item._max.attemptNumber);
  }

  const legacyRunItemIds = new Set<string>();
  const extraLegacyCounts: Record<TestResultStatus, number> = {
    passed: 0,
    failed: 0,
    skipped: 0,
    blocked: 0,
    not_run: 0,
    in_progress: 0,
  };

  for (const artifact of legacyExecutionStateArtifacts) {
    if (!artifact.runItemId || !artifact.metadata || typeof artifact.metadata !== "object") {
      continue;
    }

    const raw = artifact.metadata as Record<string, unknown>;
    if (raw.kind !== "execution_state") continue;

    const attemptNumber = Number(raw.attemptNumber);
    if (!Number.isInteger(attemptNumber) || attemptNumber <= 0) continue;

    const status = parseResultStatus(typeof raw.status === "string" ? raw.status : null) ?? "not_run";
    legacyRunItemIds.add(artifact.runItemId);
    const maxAttemptInExecutionTable = maxAttemptByRunItem.get(artifact.runItemId) ?? 0;
    if (attemptNumber > maxAttemptInExecutionTable) {
      extraLegacyCounts[status] += 1;
    }
  }

  const notRunItemsWithoutExecutionAttempts = notRunItemsWithoutExecutions.filter(
    (item) => !legacyRunItemIds.has(item.id),
  ).length;

  const notRun = counts.not_run + extraLegacyCounts.not_run + notRunItemsWithoutExecutionAttempts;
  const total =
    (counts.passed + extraLegacyCounts.passed) +
    (counts.failed + extraLegacyCounts.failed) +
    (counts.skipped + extraLegacyCounts.skipped) +
    (counts.blocked + extraLegacyCounts.blocked) +
    (counts.in_progress + extraLegacyCounts.in_progress) +
    notRun;

  const passedTotal = counts.passed + extraLegacyCounts.passed;
  const failedTotal = counts.failed + extraLegacyCounts.failed;
  const skippedTotal = counts.skipped + extraLegacyCounts.skipped;
  const blockedTotal = counts.blocked + extraLegacyCounts.blocked;
  const passRateValue = total > 0 ? (passedTotal / total) * 100 : 0;
  const passRate = new Prisma.Decimal(passRateValue.toFixed(2));

  const durationSum = durationAgg._sum.durationMs;
  const durationMs =
    typeof durationSum === "number" ? BigInt(durationSum) : null;

  return {
    total,
    passed: passedTotal,
    failed: failedTotal,
    skipped: skippedTotal,
    blocked: blockedTotal,
    notRun,
    passRate,
    durationMs,
  };
}

export async function upsertRunMetrics(db: DbClient, runId: string) {
  const metrics = await computeRunMetrics(db, runId);
  const record = await db.testRunMetrics.upsert({
    where: { runId },
    update: {
      total: metrics.total,
      passed: metrics.passed,
      failed: metrics.failed,
      skipped: metrics.skipped,
      blocked: metrics.blocked,
      notRun: metrics.notRun,
      passRate: metrics.passRate,
      durationMs: metrics.durationMs,
    },
    create: {
      run: { connect: { id: runId } },
      total: metrics.total,
      passed: metrics.passed,
      failed: metrics.failed,
      skipped: metrics.skipped,
      blocked: metrics.blocked,
      notRun: metrics.notRun,
      passRate: metrics.passRate,
      durationMs: metrics.durationMs,
    },
  });

  return toRunMetricsResponse(metrics, record.createdAt);
}

export function serializeRunMetrics(record: {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  blocked: number;
  notRun: number;
  passRate: Prisma.Decimal;
  durationMs: bigint | null;
  createdAt: Date;
}): RunMetricsResponse {
  return toRunMetricsResponse(
    {
      total: record.total,
      passed: record.passed,
      failed: record.failed,
      skipped: record.skipped,
      blocked: record.blocked,
      notRun: record.notRun,
      passRate: record.passRate,
      durationMs: record.durationMs,
    },
    record.createdAt,
  );
}

export function parseResultStatus(value?: string | null) {
  if (!value) return null;
  return RESULT_STATUS_VALUES.includes(value as TestResultStatus)
    ? (value as TestResultStatus)
    : null;
}
