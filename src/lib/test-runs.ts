import { Prisma, PrismaClient, TestResultStatus } from "@/generated/prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

const RESULT_STATUS_VALUES: TestResultStatus[] = [
  "passed",
  "failed",
  "skipped",
  "blocked",
  "not_run",
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
  const grouped = await db.testRunItem.groupBy({
    by: ["status"],
    where: { runId },
    _count: {
      _all: true,
    },
  });

  const durationAgg = await db.testRunItem.aggregate({
    where: { runId },
    _sum: { durationMs: true },
  });

  const counts: Record<TestResultStatus, number> = {
    passed: 0,
    failed: 0,
    skipped: 0,
    blocked: 0,
    not_run: 0,
  };

  for (const item of grouped) {
    counts[item.status] = item._count._all;
  }

  const total =
    counts.passed +
    counts.failed +
    counts.skipped +
    counts.blocked +
    counts.not_run;

  const passRateValue = total > 0 ? (counts.passed / total) * 100 : 0;
  const passRate = new Prisma.Decimal(passRateValue.toFixed(2));

  const durationSum = durationAgg._sum.durationMs;
  const durationMs =
    typeof durationSum === "number" ? BigInt(durationSum) : null;

  return {
    total,
    passed: counts.passed,
    failed: counts.failed,
    skipped: counts.skipped,
    blocked: counts.blocked,
    notRun: counts.not_run,
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
      runId,
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
