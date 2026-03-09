import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TextDecoder, TextEncoder } from "util";
import { AiChatWorkspace } from "./AiChatWorkspace";
import type { AiConversationDto } from "./types";

jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        activeOrganizationId: "org-1",
      },
    },
  }),
}));

describe("AiChatWorkspace", () => {
  const originalFetch = global.fetch;
  const originalClipboard = navigator.clipboard;
  const encode = new TextEncoder();

  const makeSseResponse = (parts: string[], threadId = "thread-123"): Response => {
    let cursor = 0;
    const chunks = parts.map((part) =>
      encode.encode(`data: ${JSON.stringify({ type: "AIMessageChunk", content: part })}\n`),
    );

    return {
      ok: true,
      headers: {
        get: (name: string) => (name === "X-Thread-Id" ? threadId : null),
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

  const makeConversation = (id: string, title: string, minutesAgo: number): AiConversationDto => {
    const now = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
    return {
      id,
      title,
      projectId: "proj-1",
      environment: "DEV",
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      messages: [],
    };
  };

  let storedConversations: AiConversationDto[] = [];

  beforeEach(() => {
    Object.defineProperty(global, "TextDecoder", {
      configurable: true,
      value: TextDecoder,
    });

    storedConversations = [
      makeConversation("chat-1", "Explain run #123 failures", 2),
      makeConversation("chat-2", "Generate test cases for login", 12),
      makeConversation("chat-3", "Create bug from failed test", 1440),
      makeConversation("chat-4", "Analyze flaky checkout suite", 1450),
      makeConversation("chat-5", "Summarize nightly regression", 1460),
    ];

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/organizations")) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "org-1", name: "Software Sushi", slug: "software-sushi", isActive: true, createdAt: "", updatedAt: "", _count: { members: 1, projects: 2 } }],
          }),
        } as Response;
      }

      if (url.includes("/api/projects")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              { id: "proj-1", key: "WEB", name: "Web App" },
              { id: "proj-2", key: "MOB", name: "Mobile App" },
            ],
            total: 2,
            page: 1,
            pageSize: 50,
          }),
        } as Response;
      }

      if (url.includes("/api/test-runs")) {
        return {
          ok: true,
          json: async () => ({ total: 8 }),
        } as Response;
      }

      if (url.includes("/api/bugs/stats")) {
        return {
          ok: true,
          json: async () => ({ byStatus: { open: 3 } }),
        } as Response;
      }

      if (url.includes("/api/ai/conversations?") && (!init?.method || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            items: storedConversations.slice(0, 5),
            total: Math.min(storedConversations.length, 5),
          }),
        } as Response;
      }

      if (url.endsWith("/api/ai/conversations") && init?.method === "POST") {
        const createdAt = new Date().toISOString();
        const item: AiConversationDto = {
          id: `chat-new-${storedConversations.length + 1}`,
          title: "New conversation",
          projectId: "proj-1",
          environment: "DEV",
          createdAt,
          updatedAt: createdAt,
          lastMessageAt: createdAt,
          messages: [],
        };
        storedConversations = [item, ...storedConversations].slice(0, 5);

        return {
          ok: true,
          json: async () => ({ item }),
        } as Response;
      }

      if (url.includes("/api/ai/chat")) {
        return makeSseResponse(["Hello world"]);
      }

      if (url.includes("/api/ai-chat/threads/") && url.endsWith("/document")) {
        return {
          ok: true,
          json: async () => ({
            status: "ready",
            url: "http://localhost:9000/test-documents/thread-123/generated.pdf",
            filename: "generated.pdf",
          }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({}),
      } as Response;
    }) as jest.Mock;

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
    jest.clearAllMocks();
  });

  it("renders QA header/subtitle and project context", async () => {
    render(<AiChatWorkspace />);

    expect(screen.getByText("QA Assistant")).toBeInTheDocument();
    expect(screen.getByText("Ask about run failures, bug trends, flaky tests, or test case design.")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Project: All projects")).toBeInTheDocument();
    });
  });

  it("blocks send when context uses all projects", async () => {
    render(<AiChatWorkspace />);
    await waitForHydration();

    fireEvent.change(screen.getByLabelText("Prompt message"), {
      target: { value: "Explain latest failures" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  it("loads persisted conversations after selecting a project", async () => {
    render(<AiChatWorkspace />);
    await waitForHydration();

    await applyProjectContext("proj-1");

    await waitFor(() => {
      expect(screen.getByTestId("conversation-row-chat-1")).toBeInTheDocument();
      expect(screen.getByTestId("conversation-row-chat-2")).toBeInTheDocument();
    });
  });

  it("creates a new conversation via API", async () => {
    render(<AiChatWorkspace />);
    await waitForHydration();
    await applyProjectContext("proj-1");

    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));

    await waitFor(() => {
      expect(screen.getAllByText("New conversation").length).toBeGreaterThan(0);
    });
  });

  it("auto-creates a conversation when sending with none selected", async () => {
    const aiRequests: Array<{ message: string; projectId: string; conversationId: string }> = [];

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/organizations")) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "org-1", name: "Software Sushi", slug: "software-sushi", isActive: true, createdAt: "", updatedAt: "", _count: { members: 1, projects: 2 } }],
          }),
        } as Response;
      }

      if (url.includes("/api/projects")) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "proj-1", key: "WEB", name: "Web App" }],
            total: 1,
            page: 1,
            pageSize: 50,
          }),
        } as Response;
      }

      if (url.includes("/api/test-runs")) {
        return { ok: true, json: async () => ({ total: 8 }) } as Response;
      }

      if (url.includes("/api/bugs/stats")) {
        return { ok: true, json: async () => ({ byStatus: { open: 3 } }) } as Response;
      }

      if (url.includes("/api/ai/conversations?") && (!init?.method || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({ items: [], total: 0 }),
        } as Response;
      }

      if (url.endsWith("/api/ai/conversations") && init?.method === "POST") {
        const now = new Date().toISOString();
        return {
          ok: true,
          json: async () => ({
            item: {
              id: "chat-new-1",
              title: "New conversation",
              projectId: "proj-1",
              environment: "DEV",
              createdAt: now,
              updatedAt: now,
              lastMessageAt: now,
              messages: [],
            },
          }),
        } as Response;
      }

      if (url.includes("/api/ai/chat")) {
        const parsed = JSON.parse(String(init?.body ?? "{}")) as {
          message: string;
          projectId: string;
          conversationId: string;
        };
        aiRequests.push(parsed);
        return makeSseResponse(["Hello world"]);
      }

      if (url.includes("/api/ai-chat/threads/") && url.endsWith("/document")) {
        return {
          ok: true,
          json: async () => ({
            status: "ready",
            url: "http://localhost:9000/test-documents/thread-123/generated.pdf",
            filename: "generated.pdf",
          }),
        } as Response;
      }

      return { ok: false, json: async () => ({}) } as Response;
    }) as jest.Mock;

    render(<AiChatWorkspace />);
    await waitForHydration();
    await applyProjectContext("proj-1");

    fireEvent.change(screen.getByLabelText("Prompt message"), {
      target: { value: "Hello from empty history" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(aiRequests.length).toBe(1);
      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });

    expect(aiRequests[0]).toEqual({
      message: "Hello from empty history",
      projectId: "proj-1",
      conversationId: "chat-new-1",
    });
  });

  it("sends messages using conversationId and streams assistant response", async () => {
    const aiRequests: Array<{ message: string; projectId: string; conversationId: string }> = [];

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/organizations")) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "org-1", name: "Software Sushi", slug: "software-sushi", isActive: true, createdAt: "", updatedAt: "", _count: { members: 1, projects: 2 } }],
          }),
        } as Response;
      }

      if (url.includes("/api/projects")) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "proj-1", key: "WEB", name: "Web App" }],
            total: 1,
            page: 1,
            pageSize: 50,
          }),
        } as Response;
      }

      if (url.includes("/api/test-runs")) {
        return { ok: true, json: async () => ({ total: 8 }) } as Response;
      }

      if (url.includes("/api/bugs/stats")) {
        return { ok: true, json: async () => ({ byStatus: { open: 3 } }) } as Response;
      }

      if (url.includes("/api/ai/conversations?") && (!init?.method || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            items: [makeConversation("chat-1", "Explain run #123 failures", 1)],
            total: 1,
          }),
        } as Response;
      }

      if (url.includes("/api/ai/chat")) {
        const parsed = JSON.parse(String(init?.body ?? "{}")) as {
          message: string;
          projectId: string;
          conversationId: string;
        };
        aiRequests.push(parsed);
        return makeSseResponse(["Hello world"], "thread-123");
      }

      if (url.includes("/api/ai-chat/threads/") && url.endsWith("/document")) {
        return {
          ok: true,
          json: async () => ({
            status: "ready",
            url: "http://localhost:9000/test-documents/thread-123/generated.pdf",
            filename: "generated.pdf",
          }),
        } as Response;
      }

      return { ok: false, json: async () => ({}) } as Response;
    }) as jest.Mock;

    render(<AiChatWorkspace />);
    await waitForHydration();
    await applyProjectContext("proj-1");
    await waitFor(() => {
      expect(screen.getByTestId("conversation-row-chat-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("conversation-row-chat-1"));

    fireEvent.change(screen.getByLabelText("Prompt message"), {
      target: { value: "First message" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeInTheDocument();
      expect(aiRequests.length).toBe(1);
    });

    expect(aiRequests[0]).toEqual({
      message: "First message",
      projectId: "proj-1",
      conversationId: "chat-1",
    });
  });

  it("renders fixed attachments panel with open and download actions", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/organizations")) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "org-1", name: "Software Sushi", slug: "software-sushi", isActive: true, createdAt: "", updatedAt: "", _count: { members: 1, projects: 2 } }],
          }),
        } as Response;
      }

      if (url.includes("/api/projects")) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "proj-1", key: "WEB", name: "Web App" }],
            total: 1,
            page: 1,
            pageSize: 50,
          }),
        } as Response;
      }

      if (url.includes("/api/test-runs")) {
        return { ok: true, json: async () => ({ total: 8 }) } as Response;
      }

      if (url.includes("/api/bugs/stats")) {
        return { ok: true, json: async () => ({ byStatus: { open: 3 } }) } as Response;
      }

      if (url.includes("/api/ai/conversations?") && (!init?.method || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            items: [makeConversation("chat-1", "Generate test cases", 1)],
            total: 1,
          }),
        } as Response;
      }

      if (url.includes("/api/ai/chat")) {
        return makeSseResponse(["Documento generado."], "thread-abc");
      }

      if (url.includes("/api/ai-chat/threads/thread-abc/document")) {
        return {
          ok: true,
          json: async () => ({
            status: "ready",
            url: "http://localhost:9000/test-documents/thread-abc/generated.pdf",
            filename: "generated.pdf",
          }),
        } as Response;
      }

      return { ok: false, json: async () => ({}) } as Response;
    }) as jest.Mock;

    render(<AiChatWorkspace />);
    await waitForHydration();
    await applyProjectContext("proj-1");
    await waitFor(() => {
      expect(screen.getByTestId("conversation-row-chat-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("conversation-row-chat-1"));

    fireEvent.change(screen.getByLabelText("Prompt message"), {
      target: { value: "Generate thread PDF" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByText("Adjuntos")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Abrir generated.pdf" })).toHaveAttribute(
        "href",
        "http://localhost:9000/test-documents/thread-abc/generated.pdf",
      );
      expect(screen.getByRole("link", { name: "Descargar generated.pdf" })).toHaveAttribute(
        "href",
        "http://localhost:9000/test-documents/thread-abc/generated.pdf",
      );
      expect(screen.getByTitle("Adjunto PDF generated.pdf")).toBeInTheDocument();
    });
  });

  it("renders assistant markdown when stream payload includes metadata envelope", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/organizations")) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "org-1", name: "Software Sushi", slug: "software-sushi", isActive: true, createdAt: "", updatedAt: "", _count: { members: 1, projects: 2 } }],
          }),
        } as Response;
      }

      if (url.includes("/api/projects")) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "proj-1", key: "WEB", name: "Web App" }],
            total: 1,
            page: 1,
            pageSize: 50,
          }),
        } as Response;
      }

      if (url.includes("/api/test-runs")) {
        return { ok: true, json: async () => ({ total: 8 }) } as Response;
      }

      if (url.includes("/api/bugs/stats")) {
        return { ok: true, json: async () => ({ byStatus: { open: 3 } }) } as Response;
      }

      if (url.includes("/api/ai/conversations?") && (!init?.method || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            items: [makeConversation("chat-1", "Explain run #123 failures", 1)],
            total: 1,
          }),
        } as Response;
      }

      if (url.includes("/api/ai/chat")) {
        return makeSseResponse([
          '{"structured_response":{"markdown":"## Resumen\\n\\n- Punto 1\\n- Punto 2","metadata":{"type":"analysis","sources":["BUG-42","RUN-101"],"suggestions":["Revisar el módulo X"]}}}',
        ]);
      }

      if (url.includes("/api/ai-chat/threads/") && url.endsWith("/document")) {
        return {
          ok: true,
          json: async () => ({
            status: "ready",
            url: "http://localhost:9000/test-documents/thread-123/generated.pdf",
            filename: "generated.pdf",
          }),
        } as Response;
      }

      return { ok: false, json: async () => ({}) } as Response;
    }) as jest.Mock;

    render(<AiChatWorkspace />);
    await waitForHydration();
    await applyProjectContext("proj-1");
    await waitFor(() => {
      expect(screen.getByTestId("conversation-row-chat-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("conversation-row-chat-1"));

    fireEvent.change(screen.getByLabelText("Prompt message"), {
      target: { value: "Summarize this run" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Resumen" })).toBeInTheDocument();
      expect(screen.getByText("Punto 1")).toBeInTheDocument();
      expect(screen.getByText("Punto 2")).toBeInTheDocument();
      expect(screen.queryByText("Metadata")).not.toBeInTheDocument();
      expect(screen.queryByText(/Type:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Sources:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Suggestions:/i)).not.toBeInTheDocument();
    });
  });


  it("renders message and thread PDFs in the fixed attachments panel without duplicating inline cards", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/organizations")) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "org-1", name: "Software Sushi", slug: "software-sushi", isActive: true, createdAt: "", updatedAt: "", _count: { members: 1, projects: 2 } }],
          }),
        } as Response;
      }

      if (url.includes("/api/projects")) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "proj-1", key: "WEB", name: "Web App" }],
            total: 1,
            page: 1,
            pageSize: 50,
          }),
        } as Response;
      }

      if (url.includes("/api/test-runs")) {
        return { ok: true, json: async () => ({ total: 8 }) } as Response;
      }

      if (url.includes("/api/bugs/stats")) {
        return { ok: true, json: async () => ({ byStatus: { open: 3 } }) } as Response;
      }

      if (url.includes("/api/ai/conversations?") && (!init?.method || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            items: [makeConversation("chat-1", "Generate test cases", 1)],
            total: 1,
          }),
        } as Response;
      }

      if (url.includes("/api/ai/chat")) {
        return makeSseResponse([
          '{"structured_response":{"markdown":"## Test Cases\\n\\nGenerated suite for login.","metadata":{"type":"test_cases","sources":[],"suggestions":[]}},"document_versions":[{"version":1,"url":"http://localhost:9000/test-documents/proj-1/testcases_v1.pdf","generated_at":"2026-03-05T12:00:00+00:00","test_case_count":5,"change_summary":"Version 1 generated"}]}'
        ]);
      }

      if (url.includes("/api/ai-chat/threads/") && url.endsWith("/document")) {
        return {
          ok: true,
          json: async () => ({
            status: "ready",
            url: "http://localhost:9000/test-documents/thread-123/generated.pdf",
            filename: "generated-v2.pdf",
          }),
        } as Response;
      }

      return { ok: false, json: async () => ({}) } as Response;
    }) as jest.Mock;

    render(<AiChatWorkspace />);
    await waitForHydration();
    await applyProjectContext("proj-1");
    await waitFor(() => {
      expect(screen.getByTestId("conversation-row-chat-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("conversation-row-chat-1"));

    fireEvent.change(screen.getByLabelText("Prompt message"), {
      target: { value: "Generate test cases for login" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.queryByText("Generated documents")).not.toBeInTheDocument();
      expect(screen.getByText("Adjuntos")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Abrir generated-v2.pdf" })).toHaveAttribute(
        "href",
        "http://localhost:9000/test-documents/thread-123/generated.pdf",
      );
      expect(screen.getByRole("link", { name: "Abrir testcases_v1.pdf" })).toHaveAttribute(
        "href",
        "http://localhost:9000/test-documents/proj-1/testcases_v1.pdf",
      );
      expect(screen.getAllByText("PDF generado disponible en la sección de adjuntos.").length).toBe(1);
    });
  });

  it("hydrates thread document automatically for selected conversation without manual click", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/organizations")) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "org-1", name: "Software Sushi", slug: "software-sushi", isActive: true, createdAt: "", updatedAt: "", _count: { members: 1, projects: 2 } }],
          }),
        } as Response;
      }
      if (url.includes("/api/projects")) {
        return {
          ok: true,
          json: async () => ({ items: [{ id: "proj-1", key: "WEB", name: "Web App" }], total: 1, page: 1, pageSize: 50 }),
        } as Response;
      }
      if (url.includes("/api/test-runs")) return { ok: true, json: async () => ({ total: 8 }) } as Response;
      if (url.includes("/api/bugs/stats")) return { ok: true, json: async () => ({ byStatus: { open: 3 } }) } as Response;
      if (url.includes("/api/ai/conversations?") && (!init?.method || init.method === "GET")) {
        const now = new Date().toISOString();
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "chat-1",
                title: "With thread",
                projectId: "proj-1",
                environment: "DEV",
                threadId: "thread-auto",
                createdAt: now,
                updatedAt: now,
                lastMessageAt: now,
                messages: [],
              },
            ],
            total: 1,
          }),
        } as Response;
      }
      if (url.includes("/api/ai-chat/threads/thread-auto/document")) {
        return {
          ok: true,
          json: async () => ({
            status: "ready",
            url: "http://localhost:9000/test-documents/thread-auto/generated.pdf",
            filename: "generated.pdf",
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as jest.Mock;

    render(<AiChatWorkspace />);
    await waitForHydration();
    await applyProjectContext("proj-1");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/ai-chat/threads/thread-auto/document"),
        expect.objectContaining({ cache: "no-store" }),
      );
      expect(screen.getByRole("link", { name: "Abrir generated.pdf" })).toBeInTheDocument();
    });
  });

  it("keeps attachments visible after unmount/remount when returning to chat view", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/organizations")) {
        return { ok: true, json: async () => ({ items: [{ id: "org-1", name: "Software Sushi", slug: "software-sushi", isActive: true, createdAt: "", updatedAt: "", _count: { members: 1, projects: 2 } }] }) } as Response;
      }
      if (url.includes("/api/projects")) {
        return { ok: true, json: async () => ({ items: [{ id: "proj-1", key: "WEB", name: "Web App" }], total: 1, page: 1, pageSize: 50 }) } as Response;
      }
      if (url.includes("/api/test-runs")) return { ok: true, json: async () => ({ total: 8 }) } as Response;
      if (url.includes("/api/bugs/stats")) return { ok: true, json: async () => ({ byStatus: { open: 3 } }) } as Response;
      if (url.includes("/api/ai/conversations?") && (!init?.method || init.method === "GET")) {
        const now = new Date().toISOString();
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "chat-1", title: "Thread chat", projectId: "proj-1", environment: "DEV", threadId: "thread-remount", createdAt: now, updatedAt: now, lastMessageAt: now, messages: [] }],
            total: 1,
          }),
        } as Response;
      }
      if (url.includes("/api/ai-chat/threads/thread-remount/document")) {
        return {
          ok: true,
          json: async () => ({
            status: "ready",
            url: "http://localhost:9000/test-documents/thread-remount/generated.pdf",
            filename: "generated.pdf",
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as jest.Mock;

    const first = render(<AiChatWorkspace />);
    await waitForHydration();
    await applyProjectContext("proj-1");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Abrir generated.pdf" })).toBeInTheDocument();
    });

    first.unmount();

    render(<AiChatWorkspace />);
    await waitForHydration();
    await applyProjectContext("proj-1");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Abrir generated.pdf" })).toBeInTheDocument();
    });
  });

  it("renders empty and pending attachments states", async () => {
    let pendingMode = false;
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/organizations")) return { ok: true, json: async () => ({ items: [{ id: "org-1", name: "Software Sushi", slug: "software-sushi", isActive: true, createdAt: "", updatedAt: "", _count: { members: 1, projects: 2 } }] }) } as Response;
      if (url.includes("/api/projects")) return { ok: true, json: async () => ({ items: [{ id: "proj-1", key: "WEB", name: "Web App" }], total: 1, page: 1, pageSize: 50 }) } as Response;
      if (url.includes("/api/test-runs")) return { ok: true, json: async () => ({ total: 8 }) } as Response;
      if (url.includes("/api/bugs/stats")) return { ok: true, json: async () => ({ byStatus: { open: 3 } }) } as Response;
      if (url.includes("/api/ai/conversations?") && (!init?.method || init.method === "GET")) {
        const now = new Date().toISOString();
        return {
          ok: true,
          json: async () => ({
            items: [
              { id: "chat-empty", title: "No thread", projectId: "proj-1", environment: "DEV", createdAt: now, updatedAt: now, lastMessageAt: now, messages: [] },
              { id: "chat-pending", title: "Pending thread", projectId: "proj-1", environment: "DEV", threadId: "thread-pending", createdAt: now, updatedAt: now, lastMessageAt: now, messages: [] },
            ],
            total: 2,
          }),
        } as Response;
      }
      if (url.includes("/api/ai-chat/threads/thread-pending/document")) {
        return { ok: true, json: async () => ({ status: pendingMode ? "pending" : "missing" }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as jest.Mock;

    render(<AiChatWorkspace />);
    await waitForHydration();
    await applyProjectContext("proj-1");

    await waitFor(() => {
      expect(screen.getByText("No hay PDFs generados en esta conversación.")).toBeInTheDocument();
    });

    pendingMode = true;
    fireEvent.click(screen.getByTestId("conversation-row-chat-pending"));
    await waitFor(() => {
      expect(screen.getByText("Generando documento...")).toBeInTheDocument();
    });
  });

  it("renders error state and allows retry for thread document", async () => {
    let failDocumentLookup = true;
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/organizations")) return { ok: true, json: async () => ({ items: [{ id: "org-1", name: "Software Sushi", slug: "software-sushi", isActive: true, createdAt: "", updatedAt: "", _count: { members: 1, projects: 2 } }] }) } as Response;
      if (url.includes("/api/projects")) return { ok: true, json: async () => ({ items: [{ id: "proj-1", key: "WEB", name: "Web App" }], total: 1, page: 1, pageSize: 50 }) } as Response;
      if (url.includes("/api/test-runs")) return { ok: true, json: async () => ({ total: 8 }) } as Response;
      if (url.includes("/api/bugs/stats")) return { ok: true, json: async () => ({ byStatus: { open: 3 } }) } as Response;
      if (url.includes("/api/ai/conversations?") && (!init?.method || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            items: [makeConversation("chat-1", "Error flow", 1)],
            total: 1,
          }),
        } as Response;
      }
      if (url.includes("/api/ai/chat")) return makeSseResponse(["Documento"], "thread-err");
      if (url.includes("/api/ai-chat/threads/thread-err/document")) {
        if (failDocumentLookup) {
          return { ok: false, json: async () => ({ message: "Could not fetch the generated document." }) } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            status: "ready",
            url: "http://localhost:9000/test-documents/thread-err/generated.pdf",
            filename: "generated.pdf",
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as jest.Mock;

    render(<AiChatWorkspace />);
    await waitForHydration();
    await applyProjectContext("proj-1");
    await waitFor(() => {
      expect(screen.getByTestId("conversation-row-chat-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("conversation-row-chat-1"));
    fireEvent.change(screen.getByLabelText("Prompt message"), {
      target: { value: "Generate thread PDF" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByText("Could not fetch the generated document.")).toBeInTheDocument();
    });

    failDocumentLookup = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Abrir generated.pdf" })).toBeInTheDocument();
    });
  });

  const applyProjectContext = async (projectId: string) => {
    fireEvent.click(screen.getByRole("button", { name: "Change context" }));
    fireEvent.change(screen.getByRole("combobox", { name: /Project/i }), { target: { value: projectId } });
    fireEvent.click(screen.getByRole("button", { name: "Apply context" }));
  };

  const waitForHydration = async () => {
    await waitFor(() => {
      const mockFetch = global.fetch as jest.Mock;
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(4);
    });
  };
});


