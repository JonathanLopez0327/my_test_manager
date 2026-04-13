import type { PrismaClient } from "@/generated/prisma/client";

jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn(),
  },
}));

const { checkQuota } = require("./quota") as typeof import("./quota");

describe("checkQuota temporary no-enforcement mode", () => {
  const prismaMock = {
    organization: { findUnique: jest.fn() },
    project: { count: jest.fn() },
    organizationMember: { count: jest.fn() },
    testCase: { count: jest.fn() },
    testRun: { count: jest.fn() },
  } as unknown as PrismaClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(["projects", "members", "testCases", "testRuns"] as const)(
    "always allows resource %s",
    async (resource) => {
      const result = await checkQuota(prismaMock, "org-1", resource);
      expect(result).toEqual({ allowed: true });
    },
  );

  it("does not query organization or counters", async () => {
    await checkQuota(prismaMock, "org-1", "projects");

    expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.project.count).not.toHaveBeenCalled();
    expect(prismaMock.organizationMember.count).not.toHaveBeenCalled();
    expect(prismaMock.testCase.count).not.toHaveBeenCalled();
    expect(prismaMock.testRun.count).not.toHaveBeenCalled();
  });
});
