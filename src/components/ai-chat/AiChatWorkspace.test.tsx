import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AiChatWorkspace } from "./AiChatWorkspace";

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

  beforeEach(() => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
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

  it("renders QA header/subtitle and context chips", async () => {
    render(<AiChatWorkspace />);

    expect(screen.getByRole("heading", { name: "QA Assistant" })).toBeInTheDocument();
    expect(
      screen.getByText("Ask about test runs, bugs, suites and reports."),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Workspace: Software Sushi")).toBeInTheDocument();
      expect(screen.getByText("Runs: 8")).toBeInTheDocument();
      expect(screen.getByText("Open Bugs: 3")).toBeInTheDocument();
    });
  });

  it("prefills composer when clicking a quick action", async () => {
    render(<AiChatWorkspace />);
    await waitForHydration();

    fireEvent.click(screen.getAllByRole("button", { name: "Explain failing run" })[0]);

    expect(screen.getByLabelText("Prompt message")).toHaveValue(
      "Explain why run #{{id}} failed and suggest next steps.",
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Explain failing run" })[0]);

    expect(screen.getByLabelText("Prompt message")).toHaveValue(
      "Explain why run #{{id}} failed and suggest next steps.\nExplain why run #{{id}} failed and suggest next steps.",
    );
  });

  it("shows QA-focused right panel sections and conversation titles", async () => {
    render(<AiChatWorkspace />);
    await waitForHydration();

    expect(screen.getByText("Quick actions")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("Explain run #123 failures")).toBeInTheDocument();
    expect(screen.getByTestId("conversation-meta-chat-1")).toHaveTextContent("DEV");
    expect(screen.getByTestId("conversation-meta-chat-1")).toHaveTextContent("All projects");
  });

  it("shows assistant identity and grounding metadata", async () => {
    render(<AiChatWorkspace />);
    await waitForHydration();

    expect(screen.getAllByText("QA Assistant").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Grounded on workspace data").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Copy assistant message" })).toBeInTheDocument();
  });

  it("opens and closes context modal with Escape", async () => {
    render(<AiChatWorkspace />);
    await waitForHydration();

    fireEvent.click(screen.getByRole("button", { name: "Change context" }));
    expect(screen.getByText("Change assistant context")).toBeInTheDocument();

    const applyButton = screen.getByRole("button", { name: "Apply context" });
    expect(applyButton).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: /Environment/i }), { target: { value: "PROD" } });
    expect(applyButton).toBeEnabled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Change assistant context")).not.toBeInTheDocument();
  });

  it("shows attached evidence chips and allows removing them", async () => {
    render(<AiChatWorkspace />);
    await waitForHydration();

    const file = new File(["stacktrace"], "error-log.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Attach evidence files"), {
      target: { files: [file] },
    });

    expect(screen.getByText("error-log.txt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove evidence error-log.txt" }));
    expect(screen.queryByText("error-log.txt")).not.toBeInTheDocument();
  });

  it("appends helper chip template after attaching evidence", async () => {
    render(<AiChatWorkspace />);
    await waitForHydration();

    const file = new File(["stacktrace"], "report.log", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Attach evidence files"), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Summarize" }));
    expect(screen.getByLabelText("Prompt message")).toHaveValue(
      "Summarize the attached evidence: report.log",
    );
  });

  it("marks selected conversation with active styling", async () => {
    render(<AiChatWorkspace />);
    await waitForHydration();

    const firstRow = screen.getByTestId("conversation-row-chat-1");
    expect(firstRow.className).toContain("border-brand-400");

    fireEvent.click(screen.getByTestId("conversation-row-chat-2"));

    const secondRow = screen.getByTestId("conversation-row-chat-2");
    expect(secondRow.className).toContain("border-brand-400");
    expect(firstRow.className).not.toContain("border-brand-400");
  });
});
  const waitForHydration = async () => {
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
  };
