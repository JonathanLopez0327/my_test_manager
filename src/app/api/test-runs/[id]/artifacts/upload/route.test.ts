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
      findFirst: jest.fn(),
    },
    testRunArtifact: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/s3", () => ({
  getS3Config: (_type: string) => ({ bucket: "artifacts", endpoint: "http://localhost:9000" }),
  getS3Client: (_type: string) => ({ send: jest.fn().mockResolvedValue(undefined) }),
  buildS3ObjectUrl: (_type: string, key: string) => {
    void key;
    return "http://localhost/artifacts/file";
  },
}));

type PrismaMock = {
  testRunItem: {
    findFirst: jest.Mock;
  };
  testRunArtifact: {
    create: jest.Mock;
  };
};

const prismaMock = prisma as unknown as PrismaMock;
const requireRunPermissionMock = requireRunPermission as jest.Mock;

describe("POST /api/test-runs/[id]/artifacts/upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireRunPermissionMock.mockResolvedValue({ run: { id: "run-1", projectId: "project-1" } });
    prismaMock.testRunItem.findFirst.mockResolvedValue({
      id: "item-1",
      testCase: { title: "Case", externalKey: "TC-1" },
    });
  });

  it("returns 400 when file exceeds 10 MB", async () => {
    const formData = new FormData();
    formData.set("type", "log");
    formData.set("runItemId", "item-1");
    formData.set("file", new File([new Uint8Array(11 * 1024 * 1024)], "too-large.log", { type: "text/plain" }));

    const response = await POST(
      new Request("http://localhost/api/test-runs/run-1/artifacts/upload", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "run-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toBe("Artifact exceeds the 10 MB limit.");
    expect(prismaMock.testRunArtifact.create).not.toHaveBeenCalled();
  });

  it("returns 400 when artifact type is video", async () => {
    const formData = new FormData();
    formData.set("type", "video");
    formData.set("file", new File([new Uint8Array(1024)], "recording.mp4", { type: "video/mp4" }));

    const response = await POST(
      new Request("http://localhost/api/test-runs/run-1/artifacts/upload", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "run-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toBe("Video uploads are disabled in beta.");
    expect(prismaMock.testRunArtifact.create).not.toHaveBeenCalled();
  });
});
