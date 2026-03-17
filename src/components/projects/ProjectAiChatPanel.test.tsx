import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TextDecoder, TextEncoder } from "util";
import { ProjectAiChatPanel } from "./ProjectAiChatPanel";

describe("ProjectAiChatPanel", () => {
  const originalFetch = global.fetch;
  const encode = new TextEncoder();

  const makeSseResponse = (parts: string[]): Response => {
    let cursor = 0;
    const chunks = parts.map((part) =>
      encode.encode(`data: ${JSON.stringify({ type: "AIMessageChunk", content: part })}\n`),
    );

    return {
      ok: true,
      headers: {
        get: () => null,
      },
      body: {
        getReader: () => ({
          read: async () => {
            if (cursor >= chunks.length) return { done: true, value: undefined };
            const value = chunks[cursor];
            cursor += 1;
            return { done: false, value };
          },
        }),
      },
    } as unknown as Response;
  };

  beforeEach(() => {
    Object.defineProperty(global, "TextDecoder", {
      configurable: true,
      value: TextDecoder,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("loads latest active conversation and renders thread messages", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "conv-1",
            title: "Latest conversation",
            projectId: "11111111-1111-4111-8111-111111111111",
            environment: "DEV",
            threadId: "thread-1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastMessageAt: new Date().toISOString(),
            messages: [
              {
                id: "m-1",
                role: "user",
                content: "Explain latest failures",
                createdAt: new Date().toISOString(),
              },
              {
                id: "m-2",
                role: "assistant",
                content: "Here is the summary.",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ],
        total: 1,
      }),
    })) as jest.Mock;

    render(
      <ProjectAiChatPanel
        projectId="11111111-1111-4111-8111-111111111111"
        projectName="Checkout Platform"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Explain latest failures")).toBeInTheDocument();
      expect(screen.getByText("Here is the summary.")).toBeInTheDocument();
    });
  });

  it("renders empty state when no conversations exist and does not show history list", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
      }),
    })) as jest.Mock;

    render(
      <ProjectAiChatPanel
        projectId="11111111-1111-4111-8111-111111111111"
        projectName="Checkout Platform"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Start an AI chat for this project")).toBeInTheDocument();
    });
    expect(screen.queryByText(/today/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/conversation-row/i)).not.toBeInTheDocument();
  });

  it("inserts quick action template into textarea", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    })) as jest.Mock;

    render(
      <ProjectAiChatPanel
        projectId="11111111-1111-4111-8111-111111111111"
        projectName="Checkout Platform"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Generate test cases" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate test cases" }));

    expect(screen.getByLabelText("Prompt message")).toHaveValue(
      "Generate test cases for: {{feature}}",
    );
  });

  it("creates conversation when missing and sends chat request", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (url.includes("/api/ai/conversations?")) {
        return {
          ok: true,
          json: async () => ({ items: [], total: 0 }),
        } as Response;
      }

      if (url.endsWith("/api/ai/conversations")) {
        return {
          ok: true,
          json: async () => ({
            item: {
              id: "conv-new-1",
              title: "New conversation",
              projectId: "11111111-1111-4111-8111-111111111111",
              environment: "DEV",
              threadId: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastMessageAt: new Date().toISOString(),
              messages: [],
            },
          }),
        } as Response;
      }

      if (url.endsWith("/api/ai/chat")) {
        return makeSseResponse(["This is ", "a streamed response."]);
      }

      return { ok: false, json: async () => ({}) } as Response;
    }) as jest.Mock;

    render(
      <ProjectAiChatPanel
        projectId="11111111-1111-4111-8111-111111111111"
        projectName="Checkout Platform"
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Prompt message")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Prompt message"), {
      target: { value: "Generate test coverage plan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByText("This is a streamed response.")).toBeInTheDocument();
    });

    const createCall = calls.find(
      (call) =>
        call.url.endsWith("/api/ai/conversations") &&
        String(call.init?.method || "GET").toUpperCase() === "POST",
    );
    const chatCall = calls.find((call) => call.url.endsWith("/api/ai/chat"));

    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.init?.body))).toEqual({
      projectId: "11111111-1111-4111-8111-111111111111",
    });

    expect(chatCall).toBeDefined();
    expect(JSON.parse(String(chatCall?.init?.body))).toEqual({
      message: "Generate test coverage plan",
      projectId: "11111111-1111-4111-8111-111111111111",
      conversationId: "conv-new-1",
    });
  });

  it("shows error state when chat request fails", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/ai/conversations?")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "conv-1",
                title: "Latest conversation",
                projectId: "11111111-1111-4111-8111-111111111111",
                environment: "DEV",
                threadId: "thread-1",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastMessageAt: new Date().toISOString(),
                messages: [],
              },
            ],
            total: 1,
          }),
        } as Response;
      }

      if (url.endsWith("/api/ai/chat")) {
        return {
          ok: false,
          json: async () => ({ message: "Upstream unavailable." }),
        } as Response;
      }

      return { ok: false, json: async () => ({}) } as Response;
    }) as jest.Mock;

    render(
      <ProjectAiChatPanel
        projectId="11111111-1111-4111-8111-111111111111"
        projectName="Checkout Platform"
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Prompt message")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Prompt message"), {
      target: { value: "Why this run failed?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByText("Upstream unavailable.")).toBeInTheDocument();
      expect(screen.getByText("Error communicating with the assistant.")).toBeInTheDocument();
    });
  });
});
