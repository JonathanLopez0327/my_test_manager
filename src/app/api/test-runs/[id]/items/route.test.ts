/** @jest-environment node */
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { requireRunPermission } from "@/lib/auth/require-run-permission";

const authCtx = {
  userId: "user-1",
  globalRoles: [],
  activeOrganizationId: "org-1",
  organizationRole: "admin",
};

jest.mock("@/lib/auth/with-auth", () => ({
  withAuth: (_permission: unknown, handler: unknown) =>
    (req: Request, routeCtx: { params: Promise<Record<string, string>> }) =>
      (handler as (
        req: Request,
        authCtx: typeof authCtx,
        routeCtx: { params: Promise<Record<string, string>> },
      ) => Promise<Response>)(req, authCtx, routeCtx),
}));

jest.mock("@/lib/auth/require-run-permission", () => ({
  requireRunPermission: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    testRun: {
      findUnique: jest.fn(),
    },
    testRunItem: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

type PrismaMock = {
  $transaction: jest.Mock;
  testRun: {
    findUnique: jest.Mock;
  };
  testRunItem: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
};

const prismaMock = prisma as unknown as PrismaMock;
const requireRunPermissionMock = requireRunPermission as jest.Mock;

describe("GET /api/test-runs/[id]/items", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireRunPermissionMock.mockResolvedValue({ run: { id: "run-1", projectId: "project-1" } });
    prismaMock.testRun.findUnique.mockResolvedValue({ status: "running" });
    prismaMock.testRunItem.findMany.mockResolvedValue([
      {
        id: "item-1",
        status: "not_run",
        durationMs: null,
        executedAt: null,
        errorMessage: null,
        testCase: {
          id: "tc-1",
          title: "Login",
          externalKey: "TC-1",
          preconditions: "User exists",
          steps: [{ step: "Open login", expectedResult: "Page visible" }],
          style: "step_by_step",
        },
        executedBy: null,
      },
    ]);
    prismaMock.testRunItem.count.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    );
  });

  it("includes test case execution fields for modal payload", async () => {
    const response = await GET(
      new Request("http://localhost/api/test-runs/run-1/items?page=1&pageSize=20"),
      {
        params: Promise.resolve({ id: "run-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    const body = (await response.json()) as {
      items: Array<{ testCase: { preconditions?: string | null; steps?: unknown; style?: string } }>;
    };

    expect(response.status).toBe(200);
    expect(prismaMock.testRunItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          testCase: expect.objectContaining({
            select: expect.objectContaining({
              preconditions: true,
              steps: true,
              style: true,
            }),
          }),
        }),
      }),
    );
    expect(body.items[0]?.testCase.preconditions).toBe("User exists");
    expect(body.items[0]?.testCase.style).toBe("step_by_step");
    expect(Array.isArray(body.items[0]?.testCase.steps)).toBe(true);
  });

  it("blocks item updates when run is completed", async () => {
    prismaMock.testRun.findUnique.mockResolvedValue({ status: "completed" });

    const response = await POST(
      new Request("http://localhost/api/test-runs/run-1/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: [{ testCaseId: "tc-1", status: "passed" }],
        }),
      }),
      {
        params: Promise.resolve({ id: "run-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      message: "Completed runs cannot be modified.",
    });
  });
});
