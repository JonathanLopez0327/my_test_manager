import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TextDecoder, TextEncoder } from "util";
import { ProjectAiChatPanel } from "./ProjectAiChatPanel";

describe("ProjectAiChatPanel", () => {
  const originalFetch = global.fetch;
  const encode = new TextEncoder();

  const makeSseResponse = (parts: string[], threadId?: string | null): Response => {
    let cursor = 0;
    const chunks = parts.map((part) =>
      encode.encode(`data: ${JSON.stringify({ type: "AIMessageChunk", content: part })}\n`),
    );

    return {
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "x-thread-id" ? (threadId ?? null) : null,
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
        } as Response;
      }

      if (url.includes("/api/ai-chat/threads/thread-1/document")) {
        return {
          ok: true,
          json: async () => ({ status: "missing" }),
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

  it("renders a new chat action in the panel header", async () => {
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
      expect(screen.getByRole("button", { name: "Crear nuevo chat" })).toBeInTheDocument();
    });
  });

  it("creates a new chat from header action, clears old messages and focuses composer", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

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
                threadId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastMessageAt: new Date().toISOString(),
                messages: [
                  {
                    id: "m-1",
                    role: "user",
                    content: "Old conversation message",
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
            ],
            total: 1,
          }),
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

      return { ok: false, json: async () => ({}) } as Response;
    }) as jest.Mock;

    render(
      <ProjectAiChatPanel
        projectId="11111111-1111-4111-8111-111111111111"
        projectName="Checkout Platform"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Old conversation message")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Crear nuevo chat" }));

    await waitFor(() => {
      expect(screen.queryByText("Old conversation message")).not.toBeInTheDocument();
      expect(screen.getByText("Start an AI chat for this project")).toBeInTheDocument();
    });

    const createCall = calls.find(
      (call) =>
        call.url.endsWith("/api/ai/conversations") &&
        String(call.init?.method || "GET").toUpperCase() === "POST",
    );

    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.init?.body))).toEqual({
      projectId: "11111111-1111-4111-8111-111111111111",
    });
    expect(screen.getByLabelText("Prompt message")).toHaveFocus();
  });

  it("shows controlled error when creating a new chat from header fails", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/ai/conversations?")) {
        return {
          ok: true,
          json: async () => ({ items: [], total: 0 }),
        } as Response;
      }

      if (url.endsWith("/api/ai/conversations")) {
        return {
          ok: false,
          json: async () => ({ message: "Could not create conversation." }),
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
      expect(screen.getByRole("button", { name: "Crear nuevo chat" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Crear nuevo chat" }));

    await waitFor(() => {
      expect(screen.getByText("Could not create conversation.")).toBeInTheDocument();
    });
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
        return makeSseResponse(["This is ", "a streamed response."], "thread-new-1");
      }

      if (url.includes("/api/ai-chat/threads/thread-new-1/document")) {
        return {
          ok: true,
          json: async () => ({ status: "missing" }),
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

      if (url.includes("/api/ai-chat/threads/thread-1/document")) {
        return {
          ok: true,
          json: async () => ({ status: "missing" }),
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

  it("disables new chat action while sending a message", async () => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/ai/conversations?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: "conv-1",
                title: "Latest conversation",
                projectId: "11111111-1111-4111-8111-111111111111",
                environment: "DEV",
                threadId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastMessageAt: new Date().toISOString(),
                messages: [],
              },
            ],
            total: 1,
          }),
        } as Response);
      }

      if (url.endsWith("/api/ai/chat")) {
        return new Promise<Response>(() => {});
      }

      return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
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
      target: { value: "Why did this run fail?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Crear nuevo chat" })).toBeDisabled();
    });
  });

  it("renders ready generated document from latest conversation thread", async () => {
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
                threadId: "thread-ready",
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

      if (url.includes("/api/ai-chat/threads/thread-ready/document")) {
        return {
          ok: true,
          json: async () => ({
            status: "ready",
            filename: "test-cases-v1.pdf",
            url: "https://example.com/test-cases-v1.pdf",
          }),
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
      expect(screen.getByText("PDF ready: test-cases-v1.pdf")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Expand generated document" }));

    const openLink = screen.getByRole("link", { name: "Open" });
    const downloadLink = screen.getByRole("link", { name: "Download" });
    expect(openLink).toHaveAttribute("href", "https://example.com/test-cases-v1.pdf");
    expect(downloadLink).toHaveAttribute("href", "https://example.com/test-cases-v1.pdf");
    expect(screen.getByTitle("Generated PDF test-cases-v1.pdf")).toBeInTheDocument();
  });

  it("shows pending document state after send and allows manual retry to ready", async () => {
    let documentChecks = 0;

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

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
        return makeSseResponse(["Documento generado."], "thread-pending");
      }

      if (url.includes("/api/ai-chat/threads/thread-pending/document")) {
        documentChecks += 1;
        if (documentChecks === 1) {
          return {
            ok: true,
            json: async () => ({ status: "pending" }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            status: "ready",
            filename: "thread-pending-final.pdf",
            url: "https://example.com/thread-pending-final.pdf",
          }),
        } as Response;
      }

      return { ok: false, json: async () => ({ init }) } as Response;
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
      expect(screen.getByText("The document is still generating. Retry in a few seconds.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(screen.getByText("PDF ready: thread-pending-final.pdf")).toBeInTheDocument();
    });
  });

  it("shows controlled error state when generated document fetch fails", async () => {
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
                threadId: "thread-error",
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

      if (url.includes("/api/ai-chat/threads/thread-error/document")) {
        return {
          ok: false,
          json: async () => ({ message: "Could not fetch the generated document." }),
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
      expect(screen.getByText("Could not fetch the generated document.")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByTestId("project-generated-document")).toBeInTheDocument();
  });
});
