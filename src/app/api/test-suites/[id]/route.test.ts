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
  require: jest.fn().mockResolvedValue(undefined),
  AuthorizationError: class AuthorizationError extends Error {},
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    testSuite: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    testPlan: {
      findUnique: jest.fn(),
    },
  },
}));

type PrismaMock = {
  testSuite: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  testPlan: {
    findUnique: jest.Mock;
  };
};

const prismaMock = prisma as unknown as PrismaMock;

describe("PUT /api/test-suites/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates parentSuiteId when reparenting inside the same plan", async () => {
    prismaMock.testSuite.findUnique
      .mockResolvedValueOnce({
        testPlanId: "plan-1",
        testPlan: { projectId: "project-1" },
      })
      .mockResolvedValueOnce({
        id: "suite-parent",
        testPlanId: "plan-1",
      })
      .mockResolvedValueOnce({
        parentSuiteId: null,
      });
    prismaMock.testSuite.update.mockResolvedValue({
      id: "suite-1",
      parentSuiteId: "suite-parent",
    });

    const response = await PUT(
      new Request("http://localhost/api/test-suites/suite-1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          testPlanId: "plan-1",
          parentSuiteId: "suite-parent",
          name: "Suite 1",
          description: null,
          displayOrder: 2,
        }),
      }),
      { params: Promise.resolve({ id: "suite-1" }) } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.testSuite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "suite-1" },
        data: expect.objectContaining({
          testPlanId: "plan-1",
          parentSuiteId: "suite-parent",
          name: "Suite 1",
          displayOrder: 2,
        }),
      }),
    );
  });

  it("returns 400 when reparenting would create an indirect cycle", async () => {
    prismaMock.testSuite.findUnique
      .mockResolvedValueOnce({
        testPlanId: "plan-1",
        testPlan: { projectId: "project-1" },
      })
      .mockResolvedValueOnce({
        id: "suite-child",
        testPlanId: "plan-1",
      })
      .mockResolvedValueOnce({
        parentSuiteId: "suite-1",
      });

    const response = await PUT(
      new Request("http://localhost/api/test-suites/suite-1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          testPlanId: "plan-1",
          parentSuiteId: "suite-child",
          name: "Suite 1",
        }),
      }),
      { params: Promise.resolve({ id: "suite-1" }) } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: "Invalid parent suite: cyclical hierarchy is not allowed.",
    });
    expect(prismaMock.testSuite.update).not.toHaveBeenCalled();
  });

  it("returns 400 when parent suite belongs to another plan", async () => {
    prismaMock.testSuite.findUnique
      .mockResolvedValueOnce({
        testPlanId: "plan-1",
        testPlan: { projectId: "project-1" },
      })
      .mockResolvedValueOnce({
        id: "suite-other-plan",
        testPlanId: "plan-2",
      });

    const response = await PUT(
      new Request("http://localhost/api/test-suites/suite-1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          testPlanId: "plan-1",
          parentSuiteId: "suite-other-plan",
          name: "Suite 1",
        }),
      }),
      { params: Promise.resolve({ id: "suite-1" }) } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: "Invalid parent suite.",
    });
    expect(prismaMock.testSuite.update).not.toHaveBeenCalled();
  });
});
