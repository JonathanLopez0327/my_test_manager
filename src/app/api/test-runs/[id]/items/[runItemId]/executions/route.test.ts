/** @jest-environment node */
import { POST } from "./route";
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
    testRun: {
      findUnique: jest.fn(),
    },
    testRunItem: {
      findFirst: jest.fn(),
    },
    testRunArtifact: {
      findMany: jest.fn(),
    },
  },
}));

type PrismaMock = {
  testRun: {
    findUnique: jest.Mock;
  };
  testRunItem: {
    findFirst: jest.Mock;
  };
  testRunArtifact: {
    findMany: jest.Mock;
  };
};

const prismaMock = prisma as unknown as PrismaMock;
const requireRunPermissionMock = requireRunPermission as jest.Mock;

describe("POST /api/test-runs/[id]/items/[runItemId]/executions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireRunPermissionMock.mockResolvedValue({
      run: { id: "run-1", projectId: "project-1" },
    });
    prismaMock.testRun.findUnique.mockResolvedValue({ status: "completed" });
  });

  it("returns 409 when run is completed", async () => {
    const response = await POST(
      new Request("http://localhost/api/test-runs/run-1/items/item-1/executions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "failed" }),
      }),
      {
        params: Promise.resolve({ id: "run-1", runItemId: "item-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      message: "Completed runs cannot be modified.",
    });
  });
});

