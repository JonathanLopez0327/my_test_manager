/** @jest-environment node */
import { POST } from "./route";
import { ensureProjectAccess } from "@/lib/ai/conversations";
import { getOrCreateAgentToken } from "@/lib/ai/agent-token";
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
}));

jest.mock("@/lib/ai/agent-token", () => ({
  getOrCreateAgentToken: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    aiConversation: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    aiConversationMessage: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

type PrismaMock = {
  aiConversation: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  aiConversationMessage: {
    create: jest.Mock;
  };
  $transaction: jest.Mock;
};

const ensureProjectAccessMock = ensureProjectAccess as jest.Mock;
const getOrCreateAgentTokenMock = getOrCreateAgentToken as jest.Mock;
const prismaMock = prisma as unknown as PrismaMock;
const originalEnv = process.env;
const originalFetch = global.fetch;

function createRequest() {
  return new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: "Genera plan",
      projectId: "11111111-1111-4111-8111-111111111111",
      conversationId: "22222222-2222-4222-8222-222222222222",
    }),
  });
}

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      LANGGRAPH_API_URL: "http://langgraph.local",
      LANGGRAPH_ASSISTANT_ID: "assistant-id",
      NEXT_PUBLIC_LANGGRAPH_API_KEY: "lg-key",
      NODE_ENV: "test",
    };

    ensureProjectAccessMock.mockResolvedValue(true);
    getOrCreateAgentTokenMock.mockResolvedValue("mtm-token");
    prismaMock.aiConversation.findFirst.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      threadId: null,
      title: "New conversation",
      environment: "DEV",
    });
    prismaMock.$transaction.mockResolvedValue([]);
    prismaMock.aiConversation.update.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it("sends Authorization header in /threads and /runs/stream when API key exists", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ thread_id: "thread-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response("upstream error", { status: 500 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(createRequest());

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstInit = fetchMock.mock.calls[0][1] as RequestInit;
    const secondInit = fetchMock.mock.calls[1][1] as RequestInit;

    expect(firstInit.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer lg-key",
    });

    expect(secondInit.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer lg-key",
    });
  });

  it("returns 502 in production when API key is missing", async () => {
    delete process.env.NEXT_PUBLIC_LANGGRAPH_API_KEY;
    process.env.NODE_ENV = "production";

    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(createRequest());
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(502);
    expect(body.message).toBe("LangGraph API key is not configured.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows development fallback without Authorization header", async () => {
    delete process.env.NEXT_PUBLIC_LANGGRAPH_API_KEY;
    process.env.NODE_ENV = "development";

    const fetchMock = jest.fn().mockResolvedValueOnce(new Response("upstream error", { status: 500 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(createRequest());

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(firstInit.headers).toMatchObject({
      "Content-Type": "application/json",
    });
    expect((firstInit.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});

