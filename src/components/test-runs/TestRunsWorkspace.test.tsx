import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TestRunsWorkspace } from "./TestRunsWorkspace";

jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        globalRoles: [],
      },
    },
  }),
}));

describe("TestRunsWorkspace", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/test-runs?")) {
        const params = new URL(url, "http://localhost").searchParams;
        const query = params.get("query") ?? "";
        const allRuns = [
          {
            id: "run-1",
            name: "Run One",
            status: "running",
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
            items: [
              {
                id: "a1",
                runItemId: "item-1",
                type: "log",
                name: "log.txt",
                url: "https://example.com/log.txt",
                mimeType: "text/plain",
                createdAt: "2026-03-16T00:00:00.000Z",
                sizeBytes: 120,
                metadata: {},
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
            items: [],
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
    expect(screen.getByRole("button", { name: "Artifacts" })).toBeInTheDocument();
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
    expect(screen.getByRole("menuitem", { name: "Run again" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Execute case" })).toBeInTheDocument();

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
          return body?.items?.[0]?.status === "passed" && body?.items?.[0]?.testCaseId === "tc-1";
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
      expect(screen.getByRole("combobox", { name: "Execution history" })).toBeInTheDocument();
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

    const stepInput = screen.getByLabelText("Attach evidence for step 1") as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], "evidence.png", { type: "image/png" });
    fireEvent.change(stepInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/api/test-runs/run-1/artifacts/upload")),
      ).toBe(true);
      expect(
        fetchMock.mock.calls.some((call) => {
          const [requestUrl, requestInit] = call as [string, RequestInit];
          if (!String(requestUrl).endsWith("/api/test-runs/run-1/items/item-1/executions/exec-1")) return false;
          if (requestInit?.method !== "PATCH") return false;
          const body = requestInit?.body ? JSON.parse(String(requestInit.body)) : null;
          return body?.status === "failed";
        }),
      ).toBe(true);
      expect(
        fetchMock.mock.calls.some(
          (call) => String(call[0]).endsWith("/api/test-runs/run-1/artifacts") && (call[1] as RequestInit)?.method === "POST",
        ),
      ).toBe(false);
    });

    expect(screen.queryByText("Execute test case")).not.toBeInTheDocument();
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
          if (!String(requestUrl).endsWith("/api/test-runs/run-1/items/item-1/executions/exec-1")) return false;
          if (requestInit?.method !== "PATCH") return false;
          const body = requestInit?.body ? JSON.parse(String(requestInit.body)) : null;
          return body?.status === "blocked";
        }),
      ).toBe(true);
    });

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByRole("menuitem", { name: "Execute case" }));
    await waitFor(() => {
      expect(screen.getByText("Execute test case")).toBeInTheDocument();
    });

    const stepInput = screen.getByLabelText("Attach evidence for step 1") as HTMLInputElement;
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
        return String(requestUrl).endsWith("/api/test-runs/run-1/items/item-1/executions/exec-1") && requestInit?.method === "PATCH";
      });
      const last = itemPosts[itemPosts.length - 1] as [string, RequestInit] | undefined;
      expect(last).toBeDefined();
      const body = last?.[1]?.body ? JSON.parse(String(last[1].body)) : null;
      expect(body?.status).toBe("skipped");
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

    const generalInput = screen.getByLabelText("Attach evidence for step 1") as HTMLInputElement;
    const invalid = new File([new Uint8Array([1, 2, 3])], "evidence.txt", { type: "text/plain" });
    fireEvent.change(generalInput, { target: { files: [invalid] } });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/api/test-runs/run-1/artifacts/upload")),
      ).toBe(false);
    });
  });
});
