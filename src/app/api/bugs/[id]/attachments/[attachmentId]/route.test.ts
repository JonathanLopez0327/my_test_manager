/** @jest-environment node */
import { DELETE } from "./route";
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
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const sendMock = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/s3", () => ({
  getS3Config: (_type: string) => ({ bucket: "artifacts", endpoint: "http://localhost:9000" }),
  getS3Client: (_type: string) => ({ send: sendMock }),
}));

type PrismaMock = {
  bugAttachment: {
    findUnique: jest.Mock;
    delete: jest.Mock;
  };
};

const prismaMock = prisma as unknown as PrismaMock;
const requireBugPermissionMock = requireBugPermission as jest.Mock;

describe("DELETE /api/bugs/[id]/attachments/[attachmentId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireBugPermissionMock.mockResolvedValue({
      bug: { id: "bug-1", projectId: "project-1" },
    });
    prismaMock.bugAttachment.findUnique.mockResolvedValue({
      id: "att-1",
      bugId: "bug-1",
      url: "http://localhost:9000/artifacts/bugs/bug-1/file.png",
    });
    prismaMock.bugAttachment.delete.mockResolvedValue({ id: "att-1" });
  });

  it("returns 404 when attachment does not exist", async () => {
    prismaMock.bugAttachment.findUnique.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/bugs/bug-1/attachments/att-1", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ id: "bug-1", attachmentId: "att-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 when attachment belongs to another bug", async () => {
    prismaMock.bugAttachment.findUnique.mockResolvedValue({
      id: "att-1",
      bugId: "bug-2",
      url: "http://localhost:9000/artifacts/bugs/bug-2/file.png",
    });

    const response = await DELETE(
      new Request("http://localhost/api/bugs/bug-1/attachments/att-1", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ id: "bug-1", attachmentId: "att-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(400);
    expect(prismaMock.bugAttachment.delete).not.toHaveBeenCalled();
  });

  it("deletes attachment record", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/bugs/bug-1/attachments/att-1", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ id: "bug-1", attachmentId: "att-1" }),
      } as { params: Promise<Record<string, string>> },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.bugAttachment.delete).toHaveBeenCalledWith({
      where: { id: "att-1" },
    });
    expect(sendMock).toHaveBeenCalled();
  });
});
