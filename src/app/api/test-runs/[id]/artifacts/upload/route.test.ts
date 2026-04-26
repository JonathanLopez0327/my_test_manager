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

jest.mock("@/lib/beta/quota", () => ({
  checkQuota: jest.fn().mockResolvedValue({ allowed: true }),
  quotaExceededResponse: jest.fn(),
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
    prismaMock.testRunArtifact.create.mockResolvedValue({
      id: "artifact-1",
      runId: "run-1",
      runItemId: "item-1",
      type: "screenshot",
      name: "screenshot.png",
      url: "http://localhost/artifacts/file",
      mimeType: "image/png",
      checksumSha256: "hash",
      metadata: { scope: "step", stepIndex: 0 },
      createdAt: new Date().toISOString(),
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

  it("returns 400 when screenshot is not an image", async () => {
    const formData = new FormData();
    formData.set("type", "screenshot");
    formData.set("runItemId", "item-1");
    // Plain-text bytes — neither magic-byte sniff nor allowlist accept this
    // for a screenshot upload.
    const text = new TextEncoder().encode("not an image at all\n");
    formData.set("file", new File([text], "proof.txt", { type: "text/plain" }));

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
    expect(body.message).toMatch(/not allowed for screenshot uploads|Only image files/);
    expect(prismaMock.testRunArtifact.create).not.toHaveBeenCalled();
  });

  it("persists metadata for step evidence uploads", async () => {
    const formData = new FormData();
    formData.set("type", "screenshot");
    formData.set("runItemId", "item-1");
    formData.set("metadata", JSON.stringify({ scope: "step", stepIndex: 2 }));
    const png = new Uint8Array(1024);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    formData.set("file", new File([png], "proof.png", { type: "image/png" }));

    const response = await POST(
      new Request("http://localhost/api/test-runs/run-1/artifacts/upload", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "run-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(201);
    expect(prismaMock.testRunArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: { scope: "step", stepIndex: 2 },
        }),
      }),
    );
  });
});
