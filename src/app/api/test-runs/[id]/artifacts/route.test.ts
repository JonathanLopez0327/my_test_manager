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
    testRunItem: {
      findMany: jest.fn(),
    },
    testRunArtifact: {
      createMany: jest.fn(),
    },
  },
}));

type PrismaMock = {
  testRunItem: {
    findMany: jest.Mock;
  };
  testRunArtifact: {
    createMany: jest.Mock;
  };
};

const prismaMock = prisma as unknown as PrismaMock;
const requireRunPermissionMock = requireRunPermission as jest.Mock;

describe("POST /api/test-runs/[id]/artifacts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireRunPermissionMock.mockResolvedValue({ run: { id: "run-1", projectId: "project-1" } });
    prismaMock.testRunItem.findMany.mockResolvedValue([]);
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
