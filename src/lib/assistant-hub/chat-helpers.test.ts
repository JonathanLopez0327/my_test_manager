import { buildAssistantHubUrl } from "./chat-helpers";

describe("buildAssistantHubUrl", () => {
  it("includes returnTo for global context", () => {
    const result = buildAssistantHubUrl(
      { type: "global" },
      { returnTo: "/manager/bugs?tab=open" },
    );

    expect(result).toBe("/manager/assistant?returnTo=%2Fmanager%2Fbugs%3Ftab%3Dopen");
  });

  it("preserves entity context params while adding returnTo", () => {
    const result = buildAssistantHubUrl(
      {
        type: "testSuite",
        projectId: "proj-1",
        testSuiteId: "suite-1",
        testSuiteName: "Checkout",
      },
      { returnTo: "/manager/test-management?projectId=proj-1" },
    );

    expect(result).toContain("/manager/assistant?");
    expect(result).toContain("returnTo=%2Fmanager%2Ftest-management%3FprojectId%3Dproj-1");
    expect(result).toContain("contextType=testSuite");
    expect(result).toContain("projectId=proj-1");
    expect(result).toContain("testSuiteId=suite-1");
    expect(result).toContain("testSuiteName=Checkout");
  });
});
