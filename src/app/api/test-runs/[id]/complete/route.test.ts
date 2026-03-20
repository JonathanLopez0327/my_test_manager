/** @jest-environment node */
import { NextResponse } from "next/server";
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
      updateMany: jest.fn(),
    },
  },
}));

type PrismaMock = {
  testRun: {
    updateMany: jest.Mock;
  };
};

const prismaMock = prisma as unknown as PrismaMock;
const requireRunPermissionMock = requireRunPermission as jest.Mock;

describe("POST /api/test-runs/[id]/complete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireRunPermissionMock.mockResolvedValue({
      run: { id: "run-1", projectId: "project-1" },
    });
    prismaMock.testRun.updateMany.mockResolvedValue({ count: 1 });
  });

  it("marks run as completed", async () => {
    const response = await POST(
      new Request("http://localhost/api/test-runs/run-1/complete", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "run-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.testRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1", status: { not: "completed" } },
      }),
    );
  });

  it("returns 409 when run is already completed", async () => {
    prismaMock.testRun.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(
      new Request("http://localhost/api/test-runs/run-1/complete", {
        method: "POST",
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

  it("returns 404 when run does not exist", async () => {
    requireRunPermissionMock.mockResolvedValue({
      error: NextResponse.json({ message: "Run not found." }, { status: 404 }),
    });

    const response = await POST(
      new Request("http://localhost/api/test-runs/missing/complete", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "missing" }),
      } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(404);
  });
});

