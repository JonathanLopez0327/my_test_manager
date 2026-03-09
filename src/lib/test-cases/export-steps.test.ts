import { serializeTestCaseSteps } from "./export-steps";

describe("serializeTestCaseSteps", () => {
  it("serializes step_by_step cases", () => {
    const result = serializeTestCaseSteps("step_by_step", [
      { step: "Open login page", expectedResult: "Login form is visible" },
      { step: "Submit credentials", expectedResult: "User is redirected to dashboard" },
    ]);

    expect(result.summary).toBe("2 steps");
    expect(result.detail).toContain("1. Open login page");
    expect(result.detail).toContain("=> Login form is visible");
  });

  it("serializes gherkin cases", () => {
    const result = serializeTestCaseSteps("gherkin", [
      { keyword: "Given", text: "I am on the login page" },
      { keyword: "When", text: "I submit valid credentials" },
      { keyword: "Then", text: "I see the dashboard" },
    ]);

    expect(result.summary).toBe("3 clauses");
    expect(result.detail).toContain("Given I am on the login page");
    expect(result.detail).toContain("Then I see the dashboard");
  });

  it("serializes data_driven cases", () => {
    const result = serializeTestCaseSteps("data_driven", {
      template: [
        { keyword: "Given", text: "I have user <email>" },
        { keyword: "When", text: "I login with <password>" },
      ],
      examples: {
        columns: ["email", "password"],
        rows: [
          ["qa@example.com", "secret-1"],
          ["dev@example.com", "secret-2"],
        ],
      },
    });

    expect(result.summary).toBe("2 clauses, 2 scenarios");
    expect(result.detail).toContain("Template:");
    expect(result.detail).toContain("Columns: email | password");
    expect(result.detail).toContain("1. qa@example.com | secret-1");
  });

  it("serializes api cases", () => {
    const result = serializeTestCaseSteps("api", {
      request: {
        method: "POST",
        endpoint: "/api/login",
        headers: [{ key: "Content-Type", value: "application/json" }],
        body: "{\"email\":\"qa@example.com\"}",
      },
      expectedResponse: {
        status: "200",
        headers: [{ key: "Content-Type", value: "application/json" }],
        body: "{\"token\":\"abc\"}",
      },
    });

    expect(result.summary).toBe("API request/response");
    expect(result.detail).toContain("POST /api/login");
    expect(result.detail).toContain("Expected response:");
    expect(result.detail).toContain("Status: 200");
  });
});
