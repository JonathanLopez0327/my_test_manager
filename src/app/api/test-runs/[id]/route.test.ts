/** @jest-environment node */
import { PUT } from "./route";
import { prisma } from "@/lib/prisma";

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

jest.mock("@/lib/auth/policy-engine", () => ({
  require: jest.fn(async () => true),
  AuthorizationError: class AuthorizationError extends Error {},
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    testRun: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    testPlan: {
      findUnique: jest.fn(),
    },
    testSuite: {
      findUnique: jest.fn(),
    },
  },
}));

type PrismaMock = {
  testRun: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  project: {
    findUnique: jest.Mock;
  };
  testPlan: {
    findUnique: jest.Mock;
  };
  testSuite: {
    findUnique: jest.Mock;
  };
};

const prismaMock = prisma as unknown as PrismaMock;

describe("PUT /api/test-runs/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.testRun.findUnique.mockResolvedValue({
      projectId: "project-1",
      status: "completed",
    });
  });

  it("returns 409 when run is already completed", async () => {
    const response = await PUT(
      new Request("http://localhost/api/test-runs/run-1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: "project-1",
          runType: "manual",
          status: "running",
        }),
      }),
      { params: Promise.resolve({ id: "run-1" }) } as {
        params: Promise<Record<string, string>>;
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      message: "Completed runs cannot be modified.",
    });
    expect(prismaMock.testRun.update).not.toHaveBeenCalled();
  });
});

