import { render, screen } from "@testing-library/react";
import { TestCaseDetailSheet } from "./TestCaseDetailSheet";
import type { TestCaseRecord } from "./types";

function buildBaseCase(partial: Partial<TestCaseRecord>): TestCaseRecord {
  return {
    id: "case-1",
    suiteId: "suite-1",
    title: "Validate login flow",
    description: "Checks login success path",
    preconditions: "User exists",
    style: "step_by_step",
    steps: [{ step: "Open login", expectedResult: "Login form is visible" }],
    tags: ["smoke"],
    status: "ready",
    isAutomated: true,
    automationType: "Playwright",
    automationRef: "tests/login.spec.ts",
    priority: 2,
    createdAt: "2026-03-18T12:00:00.000Z",
    updatedAt: "2026-03-18T13:00:00.000Z",
    suite: {
      id: "suite-1",
      name: "Authentication",
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
    ...partial,
  };
}

describe("TestCaseDetailSheet", () => {
  it("renders step-by-step details in read-only mode", () => {
    render(
      <TestCaseDetailSheet
        open
        testCase={buildBaseCase({})}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Validate login flow")).toBeInTheDocument();
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Open login")).toBeInTheDocument();
    expect(screen.getByText("Login form is visible")).toBeInTheDocument();
    expect(screen.getByText("Playwright")).toBeInTheDocument();
  });

  it("renders gherkin clauses", () => {
    render(
      <TestCaseDetailSheet
        open
        testCase={buildBaseCase({
          style: "gherkin",
          steps: [
            { keyword: "Given", text: "the user is on login page" },
            { keyword: "When", text: "the user submits valid credentials" },
          ] as unknown as TestCaseRecord["steps"],
        })}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Given")).toBeInTheDocument();
    expect(screen.getByText(/the user is on login page/i)).toBeInTheDocument();
    expect(screen.getByText("When")).toBeInTheDocument();
  });

  it("renders data-driven template and examples table", () => {
    render(
      <TestCaseDetailSheet
        open
        testCase={buildBaseCase({
          style: "data_driven",
          steps: {
            template: [{ keyword: "Given", text: "user logs in with <username>" }],
            examples: { columns: ["username"], rows: [["qa-user"]] },
          } as unknown as TestCaseRecord["steps"],
        })}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Template")).toBeInTheDocument();
    expect(screen.getByText("username")).toBeInTheDocument();
    expect(screen.getByText("qa-user")).toBeInTheDocument();
  });

  it("renders api request and expected response with safe fallback", () => {
    render(
      <TestCaseDetailSheet
        open
        testCase={buildBaseCase({
          style: "api",
          steps: {
            request: { method: "POST", endpoint: "/api/login", body: "{\"email\":\"qa@example.com\"}" },
            expectedResponse: { status: "200", body: "{\"ok\":true}" },
          } as unknown as TestCaseRecord["steps"],
          description: null,
          preconditions: null,
          tags: [],
        })}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Request")).toBeInTheDocument();
    expect(screen.getByText("Expected Response")).toBeInTheDocument();
    expect(screen.getByText("/api/login")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });
});
