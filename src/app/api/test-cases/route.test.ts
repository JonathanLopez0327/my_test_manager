/** @jest-environment node */
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { checkQuota } from "@/lib/beta/quota";
import { upsertRunMetrics } from "@/lib/test-runs";

const authCtx = {
  userId: "user-1",
  globalRoles: [],
  activeOrganizationId: "org-1",
  organizationRole: "admin",
};

jest.mock("@/lib/auth/with-auth", () => ({
  withAuth: (_permission: unknown, handler: unknown) =>
    (req: Request) =>
      (handler as (req: Request, ctx: typeof authCtx) => Promise<Response>)(req, authCtx),
}));

jest.mock("@/lib/auth/policy-engine", () => ({
  can: jest.fn(),
  require: jest.fn().mockResolvedValue(undefined),
  AuthorizationError: class AuthorizationError extends Error {},
}));

jest.mock("@/lib/beta/quota", () => ({
  checkQuota: jest.fn(),
  quotaExceededResponse: jest.fn(),
}));

jest.mock("@/lib/test-runs", () => ({
  upsertRunMetrics: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    testSuite: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

type TxMock = {
  testCase: { create: jest.Mock };
  testRun: { findMany: jest.Mock };
  testRunItem: { createMany: jest.Mock };
};

type PrismaMock = {
  testSuite: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

const prismaMock = prisma as unknown as PrismaMock;
const checkQuotaMock = checkQuota as jest.Mock;
const upsertRunMetricsMock = upsertRunMetrics as jest.Mock;

describe("POST /api/test-cases autosync", () => {
  let txMock: TxMock;

  beforeEach(() => {
    jest.clearAllMocks();

    checkQuotaMock.mockResolvedValue({ allowed: true });

    prismaMock.testSuite.findUnique.mockResolvedValue({
      id: "suite-1",
      testPlanId: "plan-1",
      testPlan: { projectId: "project-1" },
    });

    txMock = {
      testCase: {
        create: jest.fn().mockResolvedValue({ id: "case-1" }),
      },
      testRun: {
        findMany: jest.fn().mockResolvedValue([{ id: "run-1" }, { id: "run-2" }]),
      },
      testRunItem: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    prismaMock.$transaction.mockImplementation(async (cb: (tx: TxMock) => Promise<unknown>) =>
      cb(txMock),
    );
    upsertRunMetricsMock.mockResolvedValue(undefined);
  });

  it("creates run items in active runs and recalculates metrics", async () => {
    const response = await POST(
      new Request("http://localhost/api/test-cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          suiteId: "suite-1",
          title: "New sync test case",
          style: "step_by_step",
          steps: [],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(txMock.testRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["queued", "running"] },
          OR: [
            { suiteId: "suite-1" },
            { suiteId: null, testPlanId: "plan-1" },
          ],
        }),
      }),
    );
    expect(txMock.testRunItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { runId: "run-1", testCaseId: "case-1" },
          { runId: "run-2", testCaseId: "case-1" },
        ],
        skipDuplicates: true,
      }),
    );
    expect(upsertRunMetricsMock).toHaveBeenCalledTimes(2);
    expect(upsertRunMetricsMock).toHaveBeenCalledWith(txMock, "run-1");
    expect(upsertRunMetricsMock).toHaveBeenCalledWith(txMock, "run-2");
  });

  it("skips run-item sync when there are no active matching runs", async () => {
    txMock.testRun.findMany.mockResolvedValueOnce([]);

    const response = await POST(
      new Request("http://localhost/api/test-cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          suiteId: "suite-1",
          title: "No run match case",
          style: "step_by_step",
          steps: [],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(txMock.testRunItem.createMany).not.toHaveBeenCalled();
    expect(upsertRunMetricsMock).not.toHaveBeenCalled();
  });
});

