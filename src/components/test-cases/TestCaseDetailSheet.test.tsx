import { render, screen } from "@testing-library/react";
import { TestCaseDetailSheet } from "./TestCaseDetailSheet";
import type { TestCaseRecord } from "./types";

jest.mock("@/components/assistant-hub/AssistantHubTrigger", () => ({
  AssistantHubTrigger: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

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
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("QA Context")).toBeInTheDocument();
    expect(screen.getByText("Test Design")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("Expected Result")).toBeInTheDocument();
    expect(screen.getByText("Open login")).toBeInTheDocument();
    expect(screen.getByText("Login form is visible")).toBeInTheDocument();
    expect(screen.getAllByText("Playwright").length).toBeGreaterThan(0);
    expect(screen.getByText(/WEB · Web App · Regression Plan · Authentication/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask AI" })).toBeInTheDocument();
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

    const givenBadges = screen.getAllByText("Given");
    expect(givenBadges.length).toBeGreaterThan(0);
    expect(screen.getByText("When")).toBeInTheDocument();
    expect(screen.getByText(/the user is on login page/i)).toBeInTheDocument();
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

    expect(screen.getByText("Scenario Template")).toBeInTheDocument();
    expect(screen.getByText("username")).toBeInTheDocument();
    expect(screen.getByText("qa-user")).toBeInTheDocument();
  });

  it("renders api request and expected response with technical surfaces", () => {
    render(
      <TestCaseDetailSheet
        open
        testCase={buildBaseCase({
          style: "api",
          steps: {
            request: {
              method: "POST",
              endpoint: "/api/login",
              headers: [{ key: "Authorization", value: "Bearer token" }],
              queryParams: [{ key: "tenant", value: "acme" }],
              body: "{\"email\":\"qa@example.com\"}",
            },
            expectedResponse: {
              status: "200",
              headers: [{ key: "Content-Type", value: "application/json" }],
              assertions: ["response.ok is true"],
              body: "{\"ok\":true}",
            },
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
    expect(screen.getByText(/Status Code:/)).toBeInTheDocument();
    expect(screen.getByText("Query Params")).toBeInTheDocument();
    expect(screen.getByText("Assertions")).toBeInTheDocument();
    expect(screen.getByText("response.ok is true")).toBeInTheDocument();
  });

  it("shows concise QA context when traceability links are unavailable", () => {
    render(
      <TestCaseDetailSheet
        open
        testCase={buildBaseCase({
          automationType: null,
          automationRef: null,
          isAutomated: false,
        })}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("QA Context")).toBeInTheDocument();
    expect(screen.getByText(/Linked runs, bugs, and requirement references are not included/i)).toBeInTheDocument();
  });
});
