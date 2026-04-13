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
    testRunArtifact: {
      findMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
    },
    testRunItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    testRunItemExecution: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/s3", () => ({
  getS3Config: () => ({ bucket: "artifacts", endpoint: "http://localhost:9000" }),
  getPresignedUrl: jest.fn(async () => "http://localhost/presigned"),
}));

type PrismaMock = {
  $transaction: jest.Mock;
  testRunItem: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  testRunItemExecution: {
    findMany: jest.Mock;
  };
  testRunArtifact: {
    findMany: jest.Mock;
    count: jest.Mock;
    createMany: jest.Mock;
  };
};

const prismaMock = prisma as unknown as PrismaMock;
const requireRunPermissionMock = requireRunPermission as jest.Mock;

describe("POST /api/test-runs/[id]/artifacts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireRunPermissionMock.mockResolvedValue({ run: { id: "run-1", projectId: "project-1" } });
    prismaMock.$transaction.mockImplementation(async (ops: Array<Promise<unknown>>) => Promise.all(ops));
    prismaMock.testRunItem.findMany.mockResolvedValue([]);
    prismaMock.testRunItem.findFirst.mockResolvedValue({ id: "item-1" });
    prismaMock.testRunItemExecution.findMany.mockResolvedValue([]);
    prismaMock.testRunArtifact.findMany.mockResolvedValue([]);
    prismaMock.testRunArtifact.count.mockResolvedValue(0);
    prismaMock.testRunArtifact.createMany.mockResolvedValue({ count: 1 });
  });

  it("returns 400 when artifact type is video", async () => {
    const response = await POST(
      new Request("http://localhost/api/test-runs/run-1/artifacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artifacts: [
            {
              type: "video",
              url: "http://localhost/video.mp4",
              sizeBytes: 1024,
            },
          ],
        }),
      }),
      {
        params: Promise.resolve({ id: "run-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toBe("Video uploads are disabled in beta.");
    expect(prismaMock.testRunArtifact.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when artifact size exceeds 10 MB", async () => {
    const response = await POST(
      new Request("http://localhost/api/test-runs/run-1/artifacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artifacts: [
            {
              type: "log",
              url: "http://localhost/log.txt",
              sizeBytes: 11 * 1024 * 1024,
            },
          ],
        }),
      }),
      {
        params: Promise.resolve({ id: "run-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toBe("Artifact exceeds the 10 MB limit.");
    expect(prismaMock.testRunArtifact.createMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/test-runs/[id]/artifacts", () => {
  it("hides execution_state artifacts by default", async () => {
    prismaMock.testRunArtifact.findMany.mockResolvedValue([
      {
        id: "a-state",
        runId: "run-1",
        runItemId: "item-1",
        type: "other",
        name: "Execution state snapshot",
        url: "execution-state://run-1/item-1/1",
        mimeType: null,
        checksumSha256: null,
        metadata: { kind: "execution_state" },
        createdAt: "2026-03-17T00:00:00.000Z",
      },
      {
        id: "a-visible",
        runId: "run-1",
        runItemId: "item-1",
        type: "screenshot",
        name: "proof.png",
        url: "http://localhost/proof.png",
        mimeType: "image/png",
        checksumSha256: null,
        metadata: { kind: "execution_evidence", scope: "step", stepIndex: 0 },
        createdAt: "2026-03-17T00:00:00.000Z",
      },
    ]);
    prismaMock.testRunArtifact.count.mockResolvedValue(2);

    const response = await GET(
      new Request("http://localhost/api/test-runs/run-1/artifacts?page=1&pageSize=20"),
      {
        params: Promise.resolve({ id: "run-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    const body = (await response.json()) as { items: Array<{ id: string }>; total: number };

    expect(response.status).toBe(200);
    expect(body.items.map((item) => item.id)).toEqual(["a-visible"]);
    expect(body.total).toBe(1);
  });

  it("includes execution_state artifacts when explicitly requested", async () => {
    prismaMock.testRunArtifact.findMany.mockResolvedValue([
      {
        id: "a-state",
        runId: "run-1",
        runItemId: "item-1",
        type: "other",
        name: "Execution state snapshot",
        url: "execution-state://run-1/item-1/1",
        mimeType: null,
        checksumSha256: null,
        metadata: { kind: "execution_state" },
        createdAt: "2026-03-17T00:00:00.000Z",
      },
    ]);
    prismaMock.testRunArtifact.count.mockResolvedValue(1);

    const response = await GET(
      new Request("http://localhost/api/test-runs/run-1/artifacts?page=1&pageSize=20&includeExecutionState=true"),
      {
        params: Promise.resolve({ id: "run-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    const body = (await response.json()) as { items: Array<{ id: string }>; total: number };

    expect(response.status).toBe(200);
    expect(body.items.map((item) => item.id)).toEqual(["a-state"]);
    expect(body.total).toBe(1);
  });

  it("returns grouped artifacts by test when groupBy=test", async () => {
    prismaMock.testRunArtifact.findMany.mockResolvedValue([
      {
        id: "a-visible",
        runId: "run-1",
        runItemId: "item-1",
        executionId: "exec-1",
        type: "screenshot",
        name: "proof.png",
        url: "http://localhost/proof.png",
        mimeType: "image/png",
        checksumSha256: null,
        sizeBytes: 120n,
        metadata: { kind: "execution_evidence", scope: "step", stepIndex: 0 },
        createdAt: new Date("2026-03-17T00:00:00.000Z"),
      },
    ]);
    prismaMock.testRunArtifact.count.mockResolvedValue(1);
    prismaMock.testRunItem.findMany.mockResolvedValue([
      {
        id: "item-1",
        testCase: { id: "tc-1", title: "Login works" },
      },
    ]);
    prismaMock.testRunItemExecution.findMany.mockResolvedValue([
      {
        id: "exec-1",
        attemptNumber: 2,
        status: "failed",
        completedAt: new Date("2026-03-17T00:00:00.000Z"),
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/test-runs/run-1/artifacts?page=1&pageSize=20&groupBy=test"),
      {
        params: Promise.resolve({ id: "run-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    const body = (await response.json()) as {
      groups: Array<{
        testName: string;
        executions: Array<{ runLabel: string; artifacts: Array<{ id: string }> }>;
      }>;
      total: number;
    };

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0]?.testName).toBe("Login works");
    expect(body.groups[0]?.executions[0]?.runLabel).toBe("Execution #2");
    expect(body.groups[0]?.executions[0]?.artifacts.map((artifact) => artifact.id)).toEqual(["a-visible"]);
  });
});
