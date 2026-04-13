/** @jest-environment node */
import { NextResponse } from "next/server";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { upsertRunMetrics } from "@/lib/test-runs";

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
  prisma: {},
}));

jest.mock("@/lib/test-runs", () => ({
  upsertRunMetrics: jest.fn(),
}));

const requireRunPermissionMock = requireRunPermission as jest.Mock;
const upsertRunMetricsMock = upsertRunMetrics as jest.Mock;

describe("GET /api/test-runs/[id]/metrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireRunPermissionMock.mockResolvedValue({
      run: { id: "run-1", projectId: "project-1" },
    });
    upsertRunMetricsMock.mockResolvedValue({
      total: 6,
      passed: 4,
      failed: 2,
      skipped: 0,
      blocked: 0,
      notRun: 0,
      passRate: "66.67",
      durationMs: "8000",
      createdAt: "2026-03-24T12:00:00.000Z",
    });
  });

  it("recalculates and returns metrics on every GET", async () => {
    const response = await GET(
      new Request("http://localhost/api/test-runs/run-1/metrics"),
      {
        params: Promise.resolve({ id: "run-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(200);
    expect(upsertRunMetricsMock).toHaveBeenCalledWith(prisma, "run-1");
    await expect(response.json()).resolves.toMatchObject({
      total: 6,
      passRate: "66.67",
    });
  });

  it("returns access error when permission check fails", async () => {
    requireRunPermissionMock.mockResolvedValue({
      error: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
    });

    const response = await GET(
      new Request("http://localhost/api/test-runs/run-1/metrics"),
      {
        params: Promise.resolve({ id: "run-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(403);
    expect(upsertRunMetricsMock).not.toHaveBeenCalled();
  });
});
