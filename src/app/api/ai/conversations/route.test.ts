/** @jest-environment node */
import { POST } from "./route";
import { ensureProjectAccess, archiveOverflowConversations, mapConversationDto } from "@/lib/ai/conversations";
import { prisma } from "@/lib/prisma";

const authCtx = {
  userId: "user-1",
  globalRoles: [],
  activeOrganizationId: "org-1",
  organizationRole: "admin",
};

jest.mock("@/lib/auth/with-auth", () => ({
  withAuth: (_permission: unknown, handler: unknown) =>
    (req: Request) =>
      (handler as (req: Request, ctx: typeof authCtx) => Promise<Response>)(req, authCtx),
}));

jest.mock("@/lib/ai/conversations", () => ({
  ensureProjectAccess: jest.fn(),
  listActiveConversations: jest.fn(),
  archiveOverflowConversations: jest.fn(),
  mapConversationDto: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    aiConversation: {
      create: jest.fn(),
    },
  },
}));

type PrismaMock = {
  aiConversation: {
    create: jest.Mock;
  };
};

const ensureProjectAccessMock = ensureProjectAccess as jest.Mock;
const archiveOverflowConversationsMock = archiveOverflowConversations as jest.Mock;
const mapConversationDtoMock = mapConversationDto as jest.Mock;
const prismaMock = prisma as unknown as PrismaMock;

describe("POST /api/ai/conversations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureProjectAccessMock.mockResolvedValue(true);
    archiveOverflowConversationsMock.mockResolvedValue(undefined);
    mapConversationDtoMock.mockReturnValue({ id: "conv-1", messages: [] });
    prismaMock.aiConversation.create.mockResolvedValue({ id: "conv-1", messages: [] });
  });

  it("accepts payload without environment and persists DEV default", async () => {
    const req = new Request("http://localhost/api/ai/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(201);
    expect(prismaMock.aiConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          project: { connect: { id: "11111111-1111-4111-8111-111111111111" } },
          environment: "DEV",
        }),
      }),
    );
  });

  it("keeps provided environment when sent by existing clients", async () => {
    const req = new Request("http://localhost/api/ai/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "11111111-1111-4111-8111-111111111111",
        environment: "STAGING",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(201);
    expect(prismaMock.aiConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          project: { connect: { id: "11111111-1111-4111-8111-111111111111" } },
          environment: "STAGING",
        }),
      }),
    );
  });
});
