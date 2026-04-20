import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { TestRunsWorkspace } from "./TestRunsWorkspace";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

jest.mock("@/lib/assistant-hub", () => ({
  useAssistantHub: () => ({
    actions: {
      setContext: jest.fn(),
      open: jest.fn(),
      close: jest.fn(),
    },
    state: { isOpen: false },
    dispatch: jest.fn(),
  }),
  useScreenDataSync: jest.fn(),
}));

describe("TestRunsWorkspace", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          id: "user-1",
          globalRoles: [],
        },
      },
    });

    let runOneStatus: "running" | "completed" = "running";

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/test-runs?")) {
        const params = new URL(url, "http://localhost").searchParams;
        const query = params.get("query") ?? "";
        const allRuns = [
          {
            id: "run-1",
            name: "Run One",
            status: runOneStatus,
            runType: "manual",
            project: { id: "p1", key: "WEB", name: "Web" },
            testPlan: { id: "tp1", name: "Plan A" },
            suite: { id: "s1", name: "Suite A", testPlan: { id: "tp1", name: "Plan A" } },
            startedAt: null,
            finishedAt: null,
          },
          {
            id: "run-2",
            name: "Run Two",
            status: "completed",
            runType: "manual",
            project: { id: "p1", key: "WEB", name: "Web" },
            testPlan: { id: "tp1", name: "Plan A" },
            suite: { id: "s2", name: "Suite B", testPlan: { id: "tp1", name: "Plan A" } },
            startedAt: null,
            finishedAt: null,
          },
        ];
        const items = query
          ? allRuns.filter((run) => run.name.toLowerCase().includes(query.toLowerCase()))
          : allRuns;

        return {
          ok: true,
          json: async () => ({
            items,
            total: items.length,
            page: 1,
            pageSize: 50,
          }),
        } as Response;
      }

      if (url.endsWith("/api/test-runs/run-1/complete") && init?.method === "POST") {
        runOneStatus = "completed";
        return {
          ok: true,
          json: async () => ({ ok: true, status: "completed" }),
        } as Response;
      }

      if (url.includes("/api/projects?")) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: "p1", key: "WEB", name: "Web" }],
            total: 1,
            page: 1,
            pageSize: 50,
          }),
        } as Response;
      }

      if (url.includes("/api/test-plans?")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "tp1",
                projectId: "p1",
                name: "Plan A",
                project: { id: "p1", key: "WEB", name: "Web" },
              },
            ],
            total: 1,
            page: 1,
            pageSize: 50,
          }),
        } as Response;
      }

      if (url.includes("/api/test-suites?")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "s1",
                name: "Suite A",
                testPlan: {
                  id: "tp1",
                  name: "Plan A",
                  project: { id: "p1", key: "WEB", name: "Web" },
                },
              },
            ],
            total: 1,
            page: 1,
            pageSize: 50,
          }),
        } as Response;
      }

      if (url.includes("/api/test-runs/run-1/items?")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "item-1",
                status: "not_run",
                currentExecutionId: "exec-1",
                latestAttemptNumber: 1,
                attemptCount: 1,
                durationMs: null,
                executedAt: null,
                errorMessage: null,
                testCase: {
                  id: "tc-1",
                  title: "Login works",
                  externalKey: "TC-1",
                  preconditions: "User exists",
                  steps: [{ step: "Open login page", expectedResult: "Page loads" }],
                  style: "step_by_step",
                },
                executedBy: null,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 100,
          }),
        } as Response;
      }

      if (url.includes("/api/test-runs/run-1/metrics?refresh=true")) {
        return {
          ok: true,
          json: async () => ({
            total: 2,
            passed: 1,
            failed: 1,
            skipped: 0,
            blocked: 0,
            notRun: 0,
            passRate: "50.00",
            durationMs: "1200",
            createdAt: "2026-03-20T00:00:00.000Z",
          }),
        } as Response;
      }

      if (url.includes("/api/test-runs/run-1/metrics")) {
        return {
          ok: true,
          json: async () => ({
            total: 1,
            passed: 0,
            failed: 1,
            skipped: 0,
            blocked: 0,
            notRun: 0,
            passRate: "0.00",
            durationMs: "1000",
            createdAt: "2026-03-20T00:00:00.000Z",
          }),
        } as Response;
      }

      if (url.includes("/api/test-runs/run-2/metrics")) {
        return {
          ok: true,
          json: async () => ({
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            blocked: 0,
            notRun: 0,
            passRate: "0.00",
            durationMs: null,
            createdAt: "2026-03-20T00:00:00.000Z",
          }),
        } as Response;
      }

      if (url.includes("/api/test-runs/run-2/items?")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "item-2",
                status: "passed",
                currentExecutionId: "exec-2",
                latestAttemptNumber: 1,
                attemptCount: 1,
                durationMs: 1000,
                executedAt: "2026-03-16T00:00:00.000Z",
                errorMessage: null,
                testCase: {
                  id: "tc-2",
                  title: "Checkout works",
                  externalKey: "TC-2",
                  preconditions: null,
                  steps: [{ step: "Checkout", expectedResult: "Order created" }],
                  style: "step_by_step",
                },
                executedBy: { id: "u1", fullName: "QA User", email: "qa@example.com" },
              },
            ],
            total: 1,
            page: 1,
            pageSize: 100,
          }),
        } as Response;
      }

      if (url.includes("/api/test-runs/run-1/artifacts?") && url.includes("runItemId=item-1")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "a-img-1",
                runItemId: "item-1",
                type: "screenshot",
                name: "General.png",
                url: "https://example.com/general.png",
                mimeType: "image/png",
                createdAt: "2026-03-16T00:00:00.000Z",
                sizeBytes: 120,
                metadata: { scope: "general" },
              },
            ],
            total: 1,
            page: 1,
            pageSize: 100,
          }),
        } as Response;
      }

      if (url.endsWith("/api/test-runs/run-1/items/item-1/executions") && (!init || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            currentExecutionId: "exec-1",
            items: [
              {
                id: "exec-1",
                attemptNumber: 1,
                status: "not_run",
                startedAt: null,
                completedAt: null,
                summary: null,
                executedBy: null,
              },
            ],
          }),
        } as Response;
      }

      if (url.endsWith("/api/test-runs/run-1/items/item-1/executions") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            id: "exec-2",
            attemptNumber: 2,
          }),
        } as Response;
      }

      if (url.endsWith("/api/test-runs/run-1/items/item-1/executions/exec-1") && (!init || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            id: "exec-1",
            attemptNumber: 1,
            status: "not_run",
            startedAt: null,
            completedAt: null,
            summary: null,
            stepResults: [
              {
                id: "sr-1",
                stepIndex: 0,
                stepTextSnapshot: "Open login page",
                expectedSnapshot: "Page loads",
                status: "not_run",
                actualResult: null,
                comment: null,
              },
            ],
            artifacts: [],
            runItem: { currentExecutionId: "exec-1" },
          }),
        } as Response;
      }

      if (url.endsWith("/api/test-runs/run-1/items/item-1/executions/exec-2") && (!init || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            id: "exec-2",
            attemptNumber: 2,
            status: "not_run",
            startedAt: null,
            completedAt: null,
            summary: null,
            stepResults: [
              {
                id: "sr-2",
                stepIndex: 0,
                stepTextSnapshot: "Open login page",
                expectedSnapshot: "Page loads",
                status: "not_run",
                actualResult: null,
                comment: null,
              },
            ],
            artifacts: [],
            runItem: { currentExecutionId: "exec-2" },
          }),
        } as Response;
      }

      if (url.endsWith("/api/test-runs/run-1/items/item-1/executions/exec-1") && init?.method === "PATCH") {
        return {
          ok: true,
          json: async () => ({}),
        } as Response;
      }

      if (url.endsWith("/api/test-runs/run-1/items/item-1/executions/exec-2") && init?.method === "PATCH") {
        return {
          ok: true,
          json: async () => ({}),
        } as Response;
      }

      if (url.includes("/api/test-runs/run-1/artifacts?")) {
        return {
          ok: true,
          json: async () => ({
            groups: [
              {
                testId: "tc-1",
                testName: "Login works",
                totalArtifacts: 1,
                lastArtifactAt: "2026-03-16T00:00:00.000Z",
                executions: [
                  {
                    runId: "exec-1",
                    runLabel: "Execution #1",
                    runNumber: 1,
                    status: "failed",
                    executedAt: "2026-03-16T00:00:00.000Z",
                    artifacts: [
                      {
                        id: "a1",
                        runItemId: "item-1",
                        executionId: "exec-1",
                        type: "log",
                        name: "log.txt",
                        url: "https://example.com/log.txt",
                        mimeType: "text/plain",
                        createdAt: "2026-03-16T00:00:00.000Z",
                        sizeBytes: 120,
                        metadata: {},
                      },
                    ],
                  },
                ],
              },
            ],
            total: 1,
            page: 1,
            pageSize: 100,
          }),
        } as Response;
      }

      if (url.includes("/api/test-runs/run-2/artifacts?")) {
        return {
          ok: true,
          json: async () => ({
            groups: [],
            total: 0,
            page: 1,
            pageSize: 100,
          }),
        } as Response;
      }

      if (url.endsWith("/api/test-runs/run-1/items") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({}),
        } as Response;
      }

      if (url.endsWith("/api/test-runs/run-1/artifacts/upload") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ id: "new-artifact" }),
        } as Response;
      }

      if (url.endsWith("/api/test-runs/run-1/artifacts") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ count: 1 }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({ message: `Unhandled request: ${url}` }),
      } as Response;
    }) as jest.Mock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("renders split layout with run list and selected run details", async () => {
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Run One.*WEB/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Run Two.*WEB/i })).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "Run One" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test Cases" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Metrics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Artifacts" })).toBeInTheDocument();
  });

  it("marks run as completed from header action", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Run actions" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Run actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark as completed" }));
    expect(screen.getByText(/cannot be edited or executed again/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark completed" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const [requestUrl, requestInit] = call as [string, RequestInit];
          return String(requestUrl).endsWith("/api/test-runs/run-1/complete") && requestInit?.method === "POST";
        }),
      ).toBe(true);
    });
  });

  it("loads and renders metrics tab and supports refresh", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Run One.*WEB/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Metrics" }));

    await waitFor(() => {
      expect(screen.getByText("Status distribution")).toBeInTheDocument();
      expect(screen.getByText("Pass rate")).toBeInTheDocument();
      expect(screen.getByText("0.00%")).toBeInTheDocument();
    });

    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/test-runs/run-1/metrics")),
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Refresh metrics" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes("/api/test-runs/run-1/metrics?refresh=true")),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByText("50.00%")).toBeInTheDocument();
    });
  });

  it("changes right panel when selecting a different run", async () => {
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Run Two")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Run Two/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Run Two" })).toBeInTheDocument();
      expect(screen.getAllByText("Checkout works").length).toBeGreaterThan(0);
    });
  });

  it("locks edit and execution actions when selected run is completed", async () => {
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Run One.*WEB/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Run Two/i }));

    await waitFor(() => {
      expect(screen.getByText("Run completed. Editing and execution are locked.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Run actions" }));
    expect(screen.queryByRole("button", { name: "Mark as completed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit test run" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    const row = screen.getAllByText("Checkout works")[0]?.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;

    fireEvent.contextMenu(row);
    expect(screen.getByRole("menuitem", { name: "View execution history" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Mark as" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Execute case" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Reset" })).not.toBeInTheDocument();
  });

  it("marks test case as dirty via contextual menu and saves batch", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText("Login works").length).toBeGreaterThan(0);
    });

    const row = screen.getAllByText("Login works")[0]?.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;

    fireEvent.contextMenu(row);

    expect(screen.getByRole("menuitem", { name: "Mark as" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Execute case" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Reset" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "View execution history" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Mark as" }));
    expect(screen.getByRole("menuitem", { name: "Passed" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Failed" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Skipped" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Passed" }));

    expect(screen.getByText("1 pending changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const [requestUrl, requestInit] = call as [string, RequestInit];
          if (!String(requestUrl).endsWith("/api/test-runs/run-1/items")) return false;
          if (requestInit?.method !== "POST") return false;
          const body = requestInit?.body ? JSON.parse(String(requestInit.body)) : null;
          return (
            body?.items?.[0]?.status === "passed" &&
            body?.items?.[0]?.testCaseId === "tc-1" &&
            body?.items?.[0]?.executedById === "user-1" &&
            typeof body?.items?.[0]?.executedAt === "string"
          );
        }),
      ).toBe(true);
    });
  });

  it("confirms reset from context menu and sends immediate reset payload", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText("Login works").length).toBeGreaterThan(0);
    });

    const row = screen.getAllByText("Login works")[0]?.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByRole("menuitem", { name: "Reset" }));

    expect(screen.getByText("Reset execution")).toBeInTheDocument();
    expect(screen.getByText(/remove its execution artifacts/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const [requestUrl, requestInit] = call as [string, RequestInit];
          if (!String(requestUrl).endsWith("/api/test-runs/run-1/items")) return false;
          if (requestInit?.method !== "POST") return false;
          const body = requestInit?.body ? JSON.parse(String(requestInit.body)) : null;
          return body?.items?.[0]?.status === "not_run" && body?.items?.[0]?.testCaseId === "tc-1";
        }),
      ).toBe(true);
    });
  });

  it("renders artifacts tab in read-only mode", async () => {
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Run One.*WEB/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Artifacts" }));

    await waitFor(() => {
      expect(screen.getByText("Login works")).toBeInTheDocument();
      expect(screen.getByText(/1\s+artifact/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Login works/i }));

    await waitFor(() => {
      expect(screen.getByText("Execution #1")).toBeInTheDocument();
      expect(screen.getByText("log.txt")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Open" })).toBeInTheDocument();
    });

    expect(screen.queryByText("Upload artifact")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("searches runs using query parameter", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Run One.*WEB/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search runs" }), {
      target: { value: "Two" },
    });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/test-runs?") && String(call[0]).includes("query=Two")),
      ).toBe(true);
    });
  });

  it("opens execution history modal from context menu", async () => {
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText("Login works").length).toBeGreaterThan(0);
    });

    const row = screen.getAllByText("Login works")[0]?.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByRole("menuitem", { name: "View execution history" }));

    await waitFor(() => {
      expect(screen.getByText("Execution history")).toBeInTheDocument();
      expect(screen.getByText("Execution #1")).toBeInTheDocument();
      expect(screen.getAllByText("not run").length).toBeGreaterThan(0);
    });
  });

  it("shows only view execution history action for read-only users", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          id: "user-readonly",
          globalRoles: ["support"],
        },
      },
    });

    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText("Login works").length).toBeGreaterThan(0);
    });

    const row = screen.getAllByText("Login works")[0]?.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;

    fireEvent.contextMenu(row);

    expect(screen.getByRole("menuitem", { name: "View execution history" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Mark as" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Execute case" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Reset" })).not.toBeInTheDocument();
  });

  it("opens execution modal with history selector and saves failed status on current execution", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText("Login works").length).toBeGreaterThan(0);
    });

    const row = screen.getAllByText("Login works")[0]?.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByRole("menuitem", { name: "Execute case" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Execute test case")).toBeInTheDocument();
      expect(screen.getByText("Open login page")).toBeInTheDocument();
      expect(screen.queryByText("Run notes")).not.toBeInTheDocument();
      expect(screen.queryByText("Actual result")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Save progress/i })).not.toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Overall test result" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Pass test" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Fail test" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Pause test" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Block test" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Not applicable" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("combobox", { name: "Overall test result" }), {
      target: { value: "fail_test" },
    });

    const stepInput = (await screen.findByLabelText("Attach evidence for step 1")) as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], "evidence.png", { type: "image/png" });
    fireEvent.change(stepInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          (call) => String(call[0]).endsWith("/api/test-runs/run-1/artifacts") && (call[1] as RequestInit)?.method === "POST",
        ),
      ).toBe(false);
    });

  });

  it("creates a new execution attempt only on save, not on modal open", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText("Login works").length).toBeGreaterThan(0);
    });

    const row = screen.getAllByText("Login works")[0]?.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByRole("menuitem", { name: "Execute case" }));

    await waitFor(() => {
      expect(screen.getByText("Execute test case")).toBeInTheDocument();
    });

    // Opening the modal should NOT create a new execution attempt
    const postCallsOnOpen = fetchMock.mock.calls.filter((call) => {
      const [requestUrl, requestInit] = call as [string, RequestInit];
      return String(requestUrl).endsWith("/api/test-runs/run-1/items/item-1/executions") && requestInit?.method === "POST";
    });
    expect(postCallsOnOpen).toHaveLength(0);

    // Make a change and save — execution should be created now
    fireEvent.change(screen.getByRole("combobox", { name: "Overall test result" }), {
      target: { value: "fail_test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const [requestUrl, requestInit] = call as [string, RequestInit];
          return String(requestUrl).endsWith("/api/test-runs/run-1/items/item-1/executions") && requestInit?.method === "POST";
        }),
      ).toBe(true);
    });
  });

  it("uses global selector status even when step statuses differ, including Pause and Not applicable mappings", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText("Login works").length).toBeGreaterThan(0);
    });

    const row = screen.getAllByText("Login works")[0]?.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByRole("menuitem", { name: "Execute case" }));
    await waitFor(() => {
      expect(screen.getByText("Execute test case")).toBeInTheDocument();
      expect(screen.getByText("Open login page")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark step 1 as passed" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Overall test result" }), {
      target: { value: "pause_test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const [requestUrl, requestInit] = call as [string, RequestInit];
          if (!String(requestUrl).includes("/api/test-runs/run-1/items/item-1/executions/")) return false;
          if (requestInit?.method !== "PATCH") return false;
          const body = requestInit?.body ? JSON.parse(String(requestInit.body)) : null;
          return body?.status === "blocked" && typeof body?.durationMs === "number" && body.durationMs >= 1;
        }),
      ).toBe(true);
    });

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByRole("menuitem", { name: "Execute case" }));
    await waitFor(() => {
      expect(screen.getByText("Execute test case")).toBeInTheDocument();
    });

    const stepInput = (await screen.findByLabelText("Attach evidence for step 1")) as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], "evidence-2.png", { type: "image/png" });
    fireEvent.change(stepInput, { target: { files: [file] } });
    fireEvent.change(screen.getByRole("combobox", { name: "Overall test result" }), {
      target: { value: "not_applicable" },
    });

    expect(screen.getByText("1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => {
      const itemPosts = fetchMock.mock.calls.filter((call) => {
        const [requestUrl, requestInit] = call as [string, RequestInit];
        return String(requestUrl).includes("/api/test-runs/run-1/items/item-1/executions/") && requestInit?.method === "PATCH";
      });
      const last = itemPosts[itemPosts.length - 1] as [string, RequestInit] | undefined;
      expect(last).toBeDefined();
      const body = last?.[1]?.body ? JSON.parse(String(last[1].body)) : null;
      expect(body?.status).toBe("skipped");
    });
  });

  it("toggles passed step back to not_run without changing global result", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText("Login works").length).toBeGreaterThan(0);
    });

    const row = screen.getAllByText("Login works")[0]?.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByRole("menuitem", { name: "Execute case" }));

    await waitFor(() => {
      expect(screen.getByText("Execute test case")).toBeInTheDocument();
    });

    const globalResult = screen.getByRole("combobox", { name: "Overall test result" });
    fireEvent.change(globalResult, { target: { value: "fail_test" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark step 1 as passed" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark step 1 as passed" }));

    expect(globalResult).toHaveValue("fail_test");

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => {
      const itemPatches = fetchMock.mock.calls.filter((call) => {
        const [requestUrl, requestInit] = call as [string, RequestInit];
        return String(requestUrl).includes("/api/test-runs/run-1/items/item-1/executions/") && requestInit?.method === "PATCH";
      });
      const last = itemPatches[itemPatches.length - 1] as [string, RequestInit] | undefined;
      expect(last).toBeDefined();
      const body = last?.[1]?.body ? JSON.parse(String(last[1].body)) : null;
      expect(body?.status).toBe("failed");
      expect(body?.stepResults?.[0]?.status).toBe("not_run");
    });
  });

  it("toggles failed step back to not_run without changing global result", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText("Login works").length).toBeGreaterThan(0);
    });

    const row = screen.getAllByText("Login works")[0]?.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByRole("menuitem", { name: "Execute case" }));

    await waitFor(() => {
      expect(screen.getByText("Execute test case")).toBeInTheDocument();
    });

    const globalResult = screen.getByRole("combobox", { name: "Overall test result" });
    fireEvent.change(globalResult, { target: { value: "pass_test" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark step 1 as failed" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark step 1 as failed" }));

    expect(globalResult).toHaveValue("pass_test");

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => {
      const itemPatches = fetchMock.mock.calls.filter((call) => {
        const [requestUrl, requestInit] = call as [string, RequestInit];
        return String(requestUrl).includes("/api/test-runs/run-1/items/item-1/executions/") && requestInit?.method === "PATCH";
      });
      const last = itemPatches[itemPatches.length - 1] as [string, RequestInit] | undefined;
      expect(last).toBeDefined();
      const body = last?.[1]?.body ? JSON.parse(String(last[1].body)) : null;
      expect(body?.status).toBe("passed");
      expect(body?.stepResults?.[0]?.status).toBe("not_run");
    });
  });

  it("rejects non-image file inside execution modal", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestRunsWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText("Login works").length).toBeGreaterThan(0);
    });

    const row = screen.getAllByText("Login works")[0]?.closest("tr");
    expect(row).not.toBeNull();
    if (!row) return;

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByRole("menuitem", { name: "Execute case" }));

    await waitFor(() => {
      expect(screen.getByText("Execute test case")).toBeInTheDocument();
    });

    const generalInput = (await screen.findByLabelText("Attach evidence for step 1")) as HTMLInputElement;
    const invalid = new File([new Uint8Array([1, 2, 3])], "evidence.txt", { type: "text/plain" });
    fireEvent.change(generalInput, { target: { files: [invalid] } });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/api/test-runs/run-1/artifacts/upload")),
      ).toBe(false);
    });
  });
});
