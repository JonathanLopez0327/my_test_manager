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
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/test-plans?")) {
        return {
          ok: true,
          json: async () => ({
            items: [
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
            ],
            total: 2,
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
});
