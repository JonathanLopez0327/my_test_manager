/** @jest-environment node */

jest.mock("@/generated/prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, opts: { code: string }) {
      super(message);
      this.name = "PrismaClientKnownRequestError";
      this.code = opts.code;
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});

jest.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findUnique: jest.fn() },
    aiUsagePeriod: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    aiUsageEvent: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  checkOrgQuota,
  ensureCurrentPeriod,
  extractUsageFromEvent,
  recordAiUsage,
} from "./usage";

const PrismaKnownError = Prisma.PrismaClientKnownRequestError as unknown as new (
  message: string,
  opts: { code: string },
) => Error & { code: string };

type PrismaMock = {
  organization: { findUnique: jest.Mock };
  aiUsagePeriod: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  aiUsageEvent: { create: jest.Mock };
  $transaction: jest.Mock;
};

const prismaMock = prisma as unknown as PrismaMock;

const ORG_ID = "00000000-0000-4000-8000-000000000001";

function makePeriod(overrides: Partial<{ totalTokens: bigint; periodEnd: Date; id: string }> = {}) {
  const now = new Date();
  return {
    id: overrides.id ?? "period-1",
    organizationId: ORG_ID,
    periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    periodEnd:
      overrides.periodEnd ??
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    inputTokens: 0n,
    outputTokens: 0n,
    totalTokens: overrides.totalTokens ?? 0n,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ensureCurrentPeriod", () => {
  it("returns the existing period when one is already present", async () => {
    const period = makePeriod();
    prismaMock.aiUsagePeriod.findUnique.mockResolvedValueOnce(period);

    const result = await ensureCurrentPeriod(ORG_ID);

    expect(result).toBe(period);
    expect(prismaMock.aiUsagePeriod.create).not.toHaveBeenCalled();
  });

  it("creates a new period on first access", async () => {
    const created = makePeriod({ id: "new-period" });
    prismaMock.aiUsagePeriod.findUnique.mockResolvedValueOnce(null);
    prismaMock.aiUsagePeriod.create.mockResolvedValueOnce(created);

    const result = await ensureCurrentPeriod(ORG_ID);

    expect(result).toBe(created);
    expect(prismaMock.aiUsagePeriod.create).toHaveBeenCalledTimes(1);
    const arg = prismaMock.aiUsagePeriod.create.mock.calls[0][0];
    expect(arg.data.organizationId).toBe(ORG_ID);
    expect(arg.data.periodStart instanceof Date).toBe(true);
    expect(arg.data.periodEnd instanceof Date).toBe(true);
  });

  it("recovers from P2002 races by re-reading the period", async () => {
    const existing = makePeriod({ id: "race-winner" });
    prismaMock.aiUsagePeriod.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    prismaMock.aiUsagePeriod.create.mockRejectedValueOnce(
      new PrismaKnownError("unique violation", { code: "P2002" }),
    );

    const result = await ensureCurrentPeriod(ORG_ID);

    expect(result).toBe(existing);
    expect(prismaMock.aiUsagePeriod.findUnique).toHaveBeenCalledTimes(2);
  });

  it("re-throws non-P2002 create errors", async () => {
    prismaMock.aiUsagePeriod.findUnique.mockResolvedValueOnce(null);
    prismaMock.aiUsagePeriod.create.mockRejectedValueOnce(new Error("db offline"));

    await expect(ensureCurrentPeriod(ORG_ID)).rejects.toThrow("db offline");
  });
});

describe("checkOrgQuota", () => {
  it("allows when total tokens are under the limit", async () => {
    prismaMock.organization.findUnique.mockResolvedValueOnce({
      aiTokenLimitMonthly: 1000,
    });
    prismaMock.aiUsagePeriod.findUnique.mockResolvedValueOnce(
      makePeriod({ totalTokens: 500n }),
    );

    const result = await checkOrgQuota(ORG_ID);

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(1000);
    expect(result.used).toBe(500n);
  });

  it("blocks when total tokens equal or exceed the limit", async () => {
    prismaMock.organization.findUnique.mockResolvedValueOnce({
      aiTokenLimitMonthly: 500,
    });
    prismaMock.aiUsagePeriod.findUnique.mockResolvedValueOnce(
      makePeriod({ totalTokens: 500n }),
    );

    const result = await checkOrgQuota(ORG_ID);

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("quota_exceeded");
      expect(result.used).toBe(500n);
    }
  });

  it("allows everything when limit is 0 (current documented behaviour)", async () => {
    prismaMock.organization.findUnique.mockResolvedValueOnce({
      aiTokenLimitMonthly: 0,
    });
    prismaMock.aiUsagePeriod.findUnique.mockResolvedValueOnce(
      makePeriod({ totalTokens: 10_000n }),
    );

    const result = await checkOrgQuota(ORG_ID);

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(0);
  });

  it("treats a missing organization row as limit 0 and allows", async () => {
    prismaMock.organization.findUnique.mockResolvedValueOnce(null);
    prismaMock.aiUsagePeriod.findUnique.mockResolvedValueOnce(makePeriod());

    const result = await checkOrgQuota(ORG_ID);

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(0);
  });
});

describe("recordAiUsage", () => {
  it("skips persistence when total tokens are zero", async () => {
    await recordAiUsage({
      organizationId: ORG_ID,
      source: "chat",
      inputTokens: 0,
      outputTokens: 0,
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.aiUsagePeriod.findUnique).not.toHaveBeenCalled();
  });

  it("writes an event and increments the current period in a single transaction", async () => {
    const period = makePeriod({ id: "period-42" });
    prismaMock.aiUsagePeriod.findUnique.mockResolvedValueOnce(period);
    prismaMock.aiUsageEvent.create.mockReturnValue({ __tag: "event" });
    prismaMock.aiUsagePeriod.update.mockReturnValue({ __tag: "update" });
    prismaMock.$transaction.mockResolvedValueOnce([]);

    await recordAiUsage({
      organizationId: ORG_ID,
      userId: "user-1",
      conversationId: "conv-1",
      source: "chat",
      model: "claude-opus-4-7",
      inputTokens: 120,
      outputTokens: 80,
    });

    expect(prismaMock.aiUsageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG_ID,
        userId: "user-1",
        conversationId: "conv-1",
        source: "chat",
        model: "claude-opus-4-7",
        inputTokens: 120,
        outputTokens: 80,
        totalTokens: 200,
      }),
    });

    expect(prismaMock.aiUsagePeriod.update).toHaveBeenCalledWith({
      where: { id: "period-42" },
      data: {
        inputTokens: { increment: 120n },
        outputTokens: { increment: 80n },
        totalTokens: { increment: 200n },
      },
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction.mock.calls[0][0]).toEqual([
      { __tag: "event" },
      { __tag: "update" },
    ]);
  });

  it("coerces negative and fractional token counts to non-negative integers", async () => {
    prismaMock.aiUsagePeriod.findUnique.mockResolvedValueOnce(makePeriod());
    prismaMock.aiUsageEvent.create.mockReturnValue({});
    prismaMock.aiUsagePeriod.update.mockReturnValue({});
    prismaMock.$transaction.mockResolvedValueOnce([]);

    await recordAiUsage({
      organizationId: ORG_ID,
      source: "chat",
      inputTokens: -5,
      outputTokens: 10.7,
    });

    const eventArg = prismaMock.aiUsageEvent.create.mock.calls[0][0];
    expect(eventArg.data.inputTokens).toBe(0);
    expect(eventArg.data.outputTokens).toBe(10);
    expect(eventArg.data.totalTokens).toBe(10);
  });
});

describe("extractUsageFromEvent", () => {
  it("returns null for non-objects", () => {
    expect(extractUsageFromEvent(null)).toBeNull();
    expect(extractUsageFromEvent("hello")).toBeNull();
    expect(extractUsageFromEvent(42)).toBeNull();
  });

  it("reads usage_metadata input/output tokens", () => {
    const result = extractUsageFromEvent({
      model: "claude-opus-4-7",
      usage_metadata: { input_tokens: 50, output_tokens: 75 },
    });
    expect(result).toEqual({
      inputTokens: 50,
      outputTokens: 75,
      model: "claude-opus-4-7",
    });
  });

  it("reads OpenAI-style prompt_tokens / completion_tokens under usage", () => {
    const result = extractUsageFromEvent({
      usage: { prompt_tokens: 12, completion_tokens: 34 },
    });
    expect(result).toEqual({
      inputTokens: 12,
      outputTokens: 34,
      model: null,
    });
  });

  it("reads usage from response_metadata.usage and picks model from response_metadata", () => {
    const result = extractUsageFromEvent({
      response_metadata: {
        model: "claude-sonnet-4-6",
        usage: { input_tokens: 7, output_tokens: 3 },
      },
    });
    expect(result).toEqual({
      inputTokens: 7,
      outputTokens: 3,
      model: "claude-sonnet-4-6",
    });
  });

  it("walks into LangGraph-style [AIMessageChunk, metadata] tuples", () => {
    const tuple = [
      { type: "AIMessageChunk", content: "hi" },
      { usage_metadata: { input_tokens: 5, output_tokens: 2 }, model: "claude" },
    ];
    expect(extractUsageFromEvent(tuple)).toEqual({
      inputTokens: 5,
      outputTokens: 2,
      model: "claude",
    });
  });

  it("returns null when both input and output tokens are zero", () => {
    expect(
      extractUsageFromEvent({
        usage_metadata: { input_tokens: 0, output_tokens: 0 },
      }),
    ).toBeNull();
  });

  it("returns null when no usage field is present", () => {
    expect(extractUsageFromEvent({ foo: "bar" })).toBeNull();
  });
});
