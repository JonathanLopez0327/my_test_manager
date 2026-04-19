import { prisma } from "@/lib/prisma";
import { Prisma, type AiUsageSource } from "@/generated/prisma/client";

export type UsagePeriod = {
  id: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  inputTokens: bigint;
  outputTokens: bigint;
  totalTokens: bigint;
};

function startOfCurrentMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfNextMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/**
 * Returns the current period row for the org, creating it on first access.
 * Prisma's upsert is not atomic (SELECT + INSERT/UPDATE), so under concurrent
 * first-access we catch the unique-constraint violation and re-read.
 */
export async function ensureCurrentPeriod(
  organizationId: string,
): Promise<UsagePeriod> {
  const now = new Date();
  const periodStart = startOfCurrentMonth(now);
  const periodEnd = startOfNextMonth(now);

  const existing = await prisma.aiUsagePeriod.findUnique({
    where: {
      organizationId_periodStart: { organizationId, periodStart },
    },
  });
  if (existing) return existing;

  try {
    return await prisma.aiUsagePeriod.create({
      data: { organizationId, periodStart, periodEnd },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const row = await prisma.aiUsagePeriod.findUnique({
        where: {
          organizationId_periodStart: { organizationId, periodStart },
        },
      });
      if (row) return row;
    }
    throw err;
  }
}

export type QuotaCheck =
  | { allowed: true; used: bigint; limit: number; periodEnd: Date }
  | { allowed: false; used: bigint; limit: number; periodEnd: Date; reason: "quota_exceeded" };

/**
 * Soft pre-check: reads the current period's total and compares against the
 * org limit. Concurrent requests that pass this check may overshoot by at
 * most `max_tokens_per_request × concurrency` — acceptable for a beta.
 */
export async function checkOrgQuota(
  organizationId: string,
): Promise<QuotaCheck> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { aiTokenLimitMonthly: true },
  });

  const limit = org?.aiTokenLimitMonthly ?? 0;
  const period = await ensureCurrentPeriod(organizationId);

  if (limit > 0 && period.totalTokens >= BigInt(limit)) {
    return {
      allowed: false,
      used: period.totalTokens,
      limit,
      periodEnd: period.periodEnd,
      reason: "quota_exceeded",
    };
  }

  return {
    allowed: true,
    used: period.totalTokens,
    limit,
    periodEnd: period.periodEnd,
  };
}

type RecordUsageArgs = {
  organizationId: string;
  userId?: string | null;
  conversationId?: string | null;
  source: AiUsageSource;
  model?: string | null;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Records a usage event and increments the current period's counters in a
 * single transaction. If the event is zero-token, skip the write.
 */
export async function recordAiUsage(args: RecordUsageArgs): Promise<void> {
  const input = Math.max(0, Math.trunc(args.inputTokens || 0));
  const output = Math.max(0, Math.trunc(args.outputTokens || 0));
  const total = input + output;

  if (total === 0) return;

  const period = await ensureCurrentPeriod(args.organizationId);

  await prisma.$transaction([
    prisma.aiUsageEvent.create({
      data: {
        organizationId: args.organizationId,
        userId: args.userId ?? null,
        conversationId: args.conversationId ?? null,
        source: args.source,
        model: args.model ?? null,
        inputTokens: input,
        outputTokens: output,
        totalTokens: total,
      },
    }),
    prisma.aiUsagePeriod.update({
      where: { id: period.id },
      data: {
        inputTokens: { increment: BigInt(input) },
        outputTokens: { increment: BigInt(output) },
        totalTokens: { increment: BigInt(total) },
      },
    }),
  ]);
}

/**
 * Extracts `{input_tokens, output_tokens, model}` from a LangGraph SSE event
 * when available. Returns null when the event does not carry usage metadata.
 */
export function extractUsageFromEvent(parsed: unknown): {
  inputTokens: number;
  outputTokens: number;
  model: string | null;
} | null {
  if (!parsed || typeof parsed !== "object") return null;

  // LangGraph "messages" stream: events are tuples like [AIMessageChunk, metadata]
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const maybe = extractUsageFromEvent(item);
      if (maybe) return maybe;
    }
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  const usageCandidates: unknown[] = [
    obj.usage_metadata,
    obj.usage,
    (obj.response_metadata as Record<string, unknown> | undefined)?.usage,
  ];

  for (const candidate of usageCandidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const usage = candidate as Record<string, unknown>;
    const input = Number(
      usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens ?? 0,
    );
    const output = Number(
      usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens ?? 0,
    );
    if (!Number.isFinite(input) && !Number.isFinite(output)) continue;
    if (input === 0 && output === 0) continue;

    const model =
      typeof obj.model === "string"
        ? obj.model
        : typeof (obj.response_metadata as Record<string, unknown> | undefined)?.model ===
          "string"
          ? ((obj.response_metadata as Record<string, unknown>).model as string)
          : null;

    return {
      inputTokens: Number.isFinite(input) ? input : 0,
      outputTokens: Number.isFinite(output) ? output : 0,
      model,
    };
  }

  return null;
}
