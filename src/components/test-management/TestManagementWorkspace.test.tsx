import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TestManagementWorkspace } from "./TestManagementWorkspace";

jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        globalRoles: [],
      },
    },
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
  usePathname: () => "/manager/test-management",
  useSearchParams: () => new URLSearchParams(),
}));

describe("TestManagementWorkspace", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    const plans = [
      {
        id: "plan-1",
        projectId: "proj-1",
        name: "Regression Plan",
        description: null,
        status: "active",
        startsOn: null,
        endsOn: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        project: {
          id: "proj-1",
          key: "WEB",
          name: "Web App",
        },
      },
    ];

    const suites: Array<{
      id: string;
      testPlanId: string;
      parentSuiteId: string | null;
      name: string;
      description: string | null;
      displayOrder: number;
      createdAt: string;
      updatedAt: string;
      parent: { id: string; name: string } | null;
      testPlan: {
        id: string;
        name: string;
        project: { id: string; key: string; name: string };
      };
    }> = [
      {
        id: "suite-parent",
        testPlanId: "plan-1",
        parentSuiteId: null,
        name: "Checkout",
        description: null,
        displayOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        parent: null,
        testPlan: {
          id: "plan-1",
          name: "Regression Plan",
          project: {
            id: "proj-1",
            key: "WEB",
            name: "Web App",
          },
        },
      },
      {
        id: "suite-child",
        testPlanId: "plan-1",
        parentSuiteId: "suite-parent",
        name: "Payment",
        description: null,
        displayOrder: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        parent: { id: "suite-parent", name: "Checkout" },
        testPlan: {
          id: "plan-1",
          name: "Regression Plan",
          project: {
            id: "proj-1",
            key: "WEB",
            name: "Web App",
          },
        },
      },
    ];

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.includes("/api/test-plans?")) {
        return {
          ok: true,
          json: async () => ({
            items: plans,
            total: 1,
            page: 1,
            pageSize: 50,
          }),
        } as Response;
      }

      if (url.includes("/api/projects?")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "proj-1",
                key: "WEB",
                name: "Web App",
                description: null,
                status: "active",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            total: 1,
            page: 1,
            pageSize: 100,
          }),
        } as Response;
      }

      if (url.endsWith("/api/test-suites") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          testPlanId?: string;
          parentSuiteId?: string | null;
          name?: string;
          description?: string | null;
          displayOrder?: number | null;
        };
        const plan = plans.find((item) => item.id === body.testPlanId);
        if (!plan || !body.name?.trim()) {
          return {
            ok: false,
            json: async () => ({ message: "Plan and name are required." }),
          } as Response;
        }

        const parent =
          body.parentSuiteId && suites.find((suite) => suite.id === body.parentSuiteId)
            ? { id: body.parentSuiteId, name: suites.find((suite) => suite.id === body.parentSuiteId)!.name }
            : null;
        const createdSuite = {
          id: `suite-${suites.length + 1}`,
          testPlanId: body.testPlanId,
          parentSuiteId: body.parentSuiteId ?? null,
          name: body.name.trim(),
          description: body.description?.trim() || null,
          displayOrder: Number.isFinite(Number(body.displayOrder)) ? Number(body.displayOrder) : 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          parent,
          testPlan: {
            id: plan.id,
            name: plan.name,
            project: {
              id: plan.project.id,
              key: plan.project.key,
              name: plan.project.name,
            },
          },
        };
        suites.push(createdSuite);
        return {
          ok: true,
          json: async () => createdSuite,
        } as Response;
      }

      if (url.includes("/api/test-suites/") && method === "PUT") {
        const suiteId = url.split("/api/test-suites/")[1];
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          testPlanId?: string;
          parentSuiteId?: string | null;
          name?: string;
          description?: string | null;
          displayOrder?: number | null;
        };
        const currentSuite = suites.find((suite) => suite.id === suiteId);
        if (!currentSuite) {
          return {
            ok: false,
            json: async () => ({ message: "Test suite not found." }),
          } as Response;
        }
        if (!body.name?.trim()) {
          return {
            ok: false,
            json: async () => ({ message: "Plan and name are required." }),
          } as Response;
        }
        if (body.name.trim() === "Fail rename") {
          return {
            ok: false,
            json: async () => ({ message: "Could not update the suite." }),
          } as Response;
        }

        currentSuite.name = body.name.trim();
        currentSuite.updatedAt = new Date().toISOString();
        currentSuite.parentSuiteId = body.parentSuiteId ?? null;
        currentSuite.description = body.description?.trim() || null;
        currentSuite.displayOrder = Number.isFinite(Number(body.displayOrder))
          ? Number(body.displayOrder)
          : currentSuite.displayOrder;

        return {
          ok: true,
          json: async () => currentSuite,
        } as Response;
      }

      if (url.includes("/api/test-suites?")) {
        return {
          ok: true,
          json: async () => ({
            items: suites,
            total: suites.length,
            page: 1,
            pageSize: 50,
          }),
        } as Response;
      }

      if (url.includes("/api/test-cases/tags?")) {
        return {
          ok: true,
          json: async () => ({
            items: ["smoke", "critical"],
          }),
        } as Response;
      }

      if (url.includes("/api/test-cases?")) {
        const hasSuiteChild = url.includes("suiteId=suite-child");
        return {
          ok: true,
          json: async () => ({
            items: hasSuiteChild
              ? [
                  {
                    id: "case-1",
                    suiteId: "suite-child",
                    title: "Validate card payment",
                    description: "Happy path",
                    preconditions: null,
                    style: "step_by_step",
                    steps: [{ step: "Pay", expectedResult: "Success" }],
                    tags: ["smoke"],
                    status: "ready",
                    isAutomated: true,
                    automationType: "Playwright",
                    automationRef: "tests/payment.spec.ts",
                    priority: 2,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    suite: {
                      id: "suite-child",
                      name: "Payment",
                      testPlan: {
                        id: "plan-1",
                        name: "Regression Plan",
                        project: {
                          id: "proj-1",
                          key: "WEB",
                          name: "Web App",
                        },
                      },
                    },
                  },
                ]
              : [],
            total: hasSuiteChild ? 1 : 0,
            page: 1,
            pageSize: 10,
          }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({ message: "Unhandled request" }),
      } as Response;
    }) as jest.Mock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("renders hierarchical plan -> suite tree and empty state before suite selection", async () => {
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Regression Plan")).toBeInTheDocument();
      expect(screen.getByText("Checkout")).toBeInTheDocument();
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    expect(screen.getByText("Select a test suite")).toBeInTheDocument();
  });

  it("opens inline suite input from left panel without opening suite drawer", async () => {
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Regression Plan")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Create suite in Regression Plan"));

    await waitFor(() => {
      expect(screen.getByLabelText("New suite name for Regression Plan")).toBeInTheDocument();
    });

    expect(screen.queryByText("New test suite")).not.toBeInTheDocument();
  });

  it("creates a suite inline with Enter, trims name, and selects it", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Regression Plan")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Create suite in Regression Plan"));

    const input = await screen.findByLabelText("New suite name for Regression Plan");
    fireEvent.change(input, { target: { value: "  New Inline Suite  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const [requestUrl, requestInit] = call;
          if (String(requestUrl) !== "/api/test-suites") return false;
          if ((requestInit as RequestInit | undefined)?.method !== "POST") return false;
          const body = JSON.parse(String((requestInit as RequestInit).body ?? "{}"));
          return (
            body.testPlanId === "plan-1" &&
            body.name === "New Inline Suite" &&
            body.parentSuiteId === null
          );
        }),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getAllByText("New Inline Suite").length).toBeGreaterThan(0);
      expect(screen.getByRole("heading", { name: "New Inline Suite" })).toBeInTheDocument();
    });
  });

  it("cancels inline suite creation on Escape without calling create API", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Regression Plan")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Create suite in Regression Plan"));
    const input = await screen.findByLabelText("New suite name for Regression Plan");
    fireEvent.change(input, { target: { value: "Will be cancelled" } });
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByLabelText("New suite name for Regression Plan")).not.toBeInTheDocument();
    });

    expect(
      fetchMock.mock.calls.some(
        ([requestUrl, requestInit]) =>
          String(requestUrl) === "/api/test-suites" &&
          (requestInit as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
  });

  it("cancels inline create on empty blur and saves on valid blur", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Regression Plan")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Create suite in Regression Plan"));
    const firstInput = await screen.findByLabelText("New suite name for Regression Plan");
    fireEvent.blur(firstInput);

    await waitFor(() => {
      expect(screen.queryByLabelText("New suite name for Regression Plan")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Create suite in Regression Plan"));
    const secondInput = await screen.findByLabelText("New suite name for Regression Plan");
    fireEvent.change(secondInput, { target: { value: "Blur Suite" } });
    fireEvent.blur(secondInput);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const [requestUrl, requestInit] = call;
          if (String(requestUrl) !== "/api/test-suites") return false;
          if ((requestInit as RequestInit | undefined)?.method !== "POST") return false;
          const body = JSON.parse(String((requestInit as RequestInit).body ?? "{}"));
          return body.name === "Blur Suite";
        }),
      ).toBe(true);
    });
  });

  it("opens inline rename on double click with focus and selected text", async () => {
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Payment" }));

    const input = await screen.findByLabelText("Edit suite name");
    expect(input).toHaveFocus();
    expect((input as HTMLInputElement).value).toBe("Payment");
    expect((input as HTMLInputElement).selectionStart).toBe(0);
    expect((input as HTMLInputElement).selectionEnd).toBe("Payment".length);
  });

  it("renames suite inline with Enter using PUT and trimmed name", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Payment" }));
    const input = await screen.findByLabelText("Edit suite name");
    fireEvent.change(input, { target: { value: "  Payments Updated  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => {
          const [requestUrl, requestInit] = call;
          if (String(requestUrl) !== "/api/test-suites/suite-child") return false;
          if ((requestInit as RequestInit | undefined)?.method !== "PUT") return false;
          const body = JSON.parse(String((requestInit as RequestInit).body ?? "{}"));
          return body.name === "Payments Updated" && body.testPlanId === "plan-1";
        }),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Payments Updated" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Payments Updated" })).toBeInTheDocument();
    });
  });

  it("cancels inline rename with Escape without update request", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Payment" }));
    const input = await screen.findByLabelText("Edit suite name");
    fireEvent.change(input, { target: { value: "Will not persist" } });
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByLabelText("Edit suite name")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Payment" })).toBeInTheDocument();
    });

    expect(
      fetchMock.mock.calls.some(
        ([requestUrl, requestInit]) =>
          String(requestUrl).includes("/api/test-suites/") &&
          (requestInit as RequestInit | undefined)?.method === "PUT",
      ),
    ).toBe(false);
  });

  it("does not send update request when renamed value is unchanged after trim", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Payment" }));
    const input = await screen.findByLabelText("Edit suite name");
    fireEvent.change(input, { target: { value: "  Payment  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.queryByLabelText("Edit suite name")).not.toBeInTheDocument();
    });

    expect(
      fetchMock.mock.calls.some(
        ([requestUrl, requestInit]) =>
          String(requestUrl).includes("/api/test-suites/") &&
          (requestInit as RequestInit | undefined)?.method === "PUT",
      ),
    ).toBe(false);
  });

  it("handles inline rename blur and API error with inline feedback", async () => {
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Checkout" }));
    const firstInput = await screen.findByLabelText("Edit suite name");
    fireEvent.change(firstInput, { target: { value: "   " } });
    fireEvent.blur(firstInput);

    await waitFor(() => {
      expect(screen.queryByLabelText("Edit suite name")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Checkout" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Payment" }));
    const secondInput = await screen.findByLabelText("Edit suite name");
    fireEvent.change(secondInput, { target: { value: "Fail rename" } });
    fireEvent.blur(secondInput);

    await waitFor(() => {
      expect(screen.queryByLabelText("Edit suite name")).not.toBeInTheDocument();
      expect(screen.getByText("Could not update the suite.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Payment" })).toBeInTheDocument();
    });
  });

  it("coordinates inline create and rename modes without conflicts", async () => {
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Regression Plan")).toBeInTheDocument();
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Create suite in Regression Plan"));
    expect(screen.getByLabelText("New suite name for Regression Plan")).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByRole("button", { name: "Payment" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("New suite name for Regression Plan")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Edit suite name")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Create suite in Regression Plan"));

    await waitFor(() => {
      expect(screen.queryByLabelText("Edit suite name")).not.toBeInTheDocument();
      expect(screen.getByLabelText("New suite name for Regression Plan")).toBeInTheDocument();
    });
  });

  it("loads suite cases when a suite is selected", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Payment" }));

    await waitFor(() => {
      expect(screen.getAllByText("Validate card payment").length).toBeGreaterThan(0);
    });

    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("/api/test-cases?") &&
        String(call[0]).includes("suiteId=suite-child"),
      ),
    ).toBe(true);
  });

  it("applies status and priority filters to test case requests", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Payment" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Filter by status")).toBeInTheDocument();
      expect(screen.getByLabelText("Filter by priority")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Filter by status"), {
      target: { value: "ready" },
    });
    fireEvent.change(screen.getByLabelText("Filter by priority"), {
      target: { value: "2" },
    });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes("/api/test-cases?") &&
          String(call[0]).includes("suiteId=suite-child") &&
          String(call[0]).includes("status=ready") &&
          String(call[0]).includes("priority=2"),
        ),
      ).toBe(true);
    });
  });

  it("opens read-only test case detail when case title is clicked", async () => {
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Payment" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Validate card payment" }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Validate card payment" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Automation Ref")).toBeInTheDocument();
      expect(screen.getByText("tests/payment.spec.ts")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByText("Automation Ref")).not.toBeInTheDocument();
    });
  });

  it("keeps Edit case behavior available from row actions", async () => {
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Payment" }));

    await waitFor(() => {
      expect(screen.getAllByLabelText("Edit case").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByLabelText("Edit case")[0]);

    await waitFor(() => {
      expect(screen.getByText("Edit Test Case")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save Test Case" })).toBeInTheDocument();
    });
  });

  it("uses a single export dropdown and opens xlsx/pdf exports with active filters", async () => {
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);

    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Payment" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Export options")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Export Excel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export PDF" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search title, suite, or plan..."), {
      target: { value: "payment" },
    });
    fireEvent.change(screen.getByDisplayValue("All tags"), { target: { value: "smoke" } });
    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "ready" } });
    fireEvent.change(screen.getByLabelText("Filter by priority"), { target: { value: "2" } });

    fireEvent.change(screen.getByLabelText("Export options"), { target: { value: "xlsx" } });
    fireEvent.change(screen.getByLabelText("Export options"), { target: { value: "pdf" } });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(2);
    });

    const firstUrl = String(openSpy.mock.calls[0]?.[0]);
    const secondUrl = String(openSpy.mock.calls[1]?.[0]);

    expect(firstUrl).toContain("/api/test-cases/export?");
    expect(firstUrl).toContain("format=xlsx");
    expect(firstUrl).toContain("suiteId=suite-child");
    expect(firstUrl).toContain("query=payment");
    expect(firstUrl).toContain("tag=smoke");
    expect(firstUrl).toContain("status=ready");
    expect(firstUrl).toContain("priority=2");

    expect(secondUrl).toContain("/api/test-cases/export?");
    expect(secondUrl).toContain("format=pdf");
    expect(secondUrl).toContain("suiteId=suite-child");
    expect(secondUrl).toContain("query=payment");
    expect(secondUrl).toContain("tag=smoke");
    expect(secondUrl).toContain("status=ready");
    expect(secondUrl).toContain("priority=2");

    openSpy.mockRestore();
  });

  it("renders rows-per-page selector in footer pagination and updates request pageSize", async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<TestManagementWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Payment" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Rows per page")).toBeInTheDocument();
    });

    expect(screen.getAllByLabelText("Rows per page")).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Rows per page"), {
      target: { value: "20" },
    });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes("/api/test-cases?") &&
          String(call[0]).includes("suiteId=suite-child") &&
          String(call[0]).includes("pageSize=20"),
        ),
      ).toBe(true);
    });
  });
});
