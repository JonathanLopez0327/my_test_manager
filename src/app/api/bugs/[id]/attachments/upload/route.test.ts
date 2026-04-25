/** @jest-environment node */
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { requireBugPermission } from "@/lib/auth/require-bug-permission";

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

jest.mock("@/lib/auth/require-bug-permission", () => ({
  requireBugPermission: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    bugAttachment: {
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
  bugAttachment: {
    create: jest.Mock;
  };
};

const prismaMock = prisma as unknown as PrismaMock;
const requireBugPermissionMock = requireBugPermission as jest.Mock;

describe("POST /api/bugs/[id]/attachments/upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireBugPermissionMock.mockResolvedValue({
      bug: { id: "bug-1", projectId: "project-1" },
    });
    prismaMock.bugAttachment.create.mockResolvedValue({
      id: "att-1",
      bugId: "bug-1",
      type: "screenshot",
      name: "proof.png",
      url: "http://localhost/artifacts/file",
      mimeType: "image/png",
      sizeBytes: BigInt(1024),
      checksumSha256: "hash",
      metadata: {},
      createdAt: new Date().toISOString(),
    });
  });

  it("returns 400 when file exceeds 10 MB", async () => {
    const formData = new FormData();
    formData.set("type", "log");
    formData.set("file", new File([new Uint8Array(11 * 1024 * 1024)], "too-large.log", { type: "text/plain" }));

    const response = await POST(
      new Request("http://localhost/api/bugs/bug-1/attachments/upload", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "bug-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toBe("Artifact exceeds the 10 MB limit.");
    expect(prismaMock.bugAttachment.create).not.toHaveBeenCalled();
  });

  it("returns 400 when type is video", async () => {
    const formData = new FormData();
    formData.set("type", "video");
    formData.set("file", new File([new Uint8Array(1024)], "recording.mp4", { type: "video/mp4" }));

    const response = await POST(
      new Request("http://localhost/api/bugs/bug-1/attachments/upload", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "bug-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toBe("Video uploads are disabled in beta.");
    expect(prismaMock.bugAttachment.create).not.toHaveBeenCalled();
  });

  it("creates attachment for valid file", async () => {
    const formData = new FormData();
    formData.set("type", "screenshot");
    // Magic-byte PNG header so the server-side sniffer accepts the upload.
    const png = new Uint8Array(1024);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    formData.set("file", new File([png], "proof.png", { type: "image/png" }));

    const response = await POST(
      new Request("http://localhost/api/bugs/bug-1/attachments/upload", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "bug-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(201);
    expect(prismaMock.bugAttachment.create).toHaveBeenCalled();
  });
});
