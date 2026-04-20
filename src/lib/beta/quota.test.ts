/** @jest-environment node */

jest.mock("@/lib/keygen/license-sync", () => ({
  ensureLicenseStatus: jest.fn().mockResolvedValue(undefined),
}));

import type { PrismaClient } from "@/generated/prisma/client";
import { checkQuota } from "./quota";
import { ensureLicenseStatus } from "@/lib/keygen/license-sync";

type PrismaStub = {
  organization: { findUnique: jest.Mock };
  project: { count: jest.Mock };
  organizationMember: { count: jest.Mock };
  testCase: { count: jest.Mock };
  testRun: { count: jest.Mock };
};

function makePrisma(): PrismaStub {
  return {
    organization: { findUnique: jest.fn() },
    project: { count: jest.fn() },
    organizationMember: { count: jest.fn() },
    testCase: { count: jest.fn() },
    testRun: { count: jest.fn() },
  };
}

const FUTURE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
const PAST = new Date(Date.now() - 1000 * 60 * 60 * 24);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("checkQuota", () => {
  it("calls ensureLicenseStatus for the organization", async () => {
    const prisma = makePrisma();
    prisma.organization.findUnique.mockResolvedValueOnce(null);

    await checkQuota(prisma as unknown as PrismaClient, "org-1", "projects");

    expect(ensureLicenseStatus).toHaveBeenCalledWith("org-1");
  });

  it("allows when the organization is not found (no enforcement target)", async () => {
    const prisma = makePrisma();
    prisma.organization.findUnique.mockResolvedValueOnce(null);

    const result = await checkQuota(
      prisma as unknown as PrismaClient,
      "org-1",
      "projects",
    );

    expect(result).toEqual({ allowed: true });
    expect(prisma.project.count).not.toHaveBeenCalled();
  });

  it("blocks with BETA_EXPIRED when betaExpiresAt is in the past", async () => {
    const prisma = makePrisma();
    prisma.organization.findUnique.mockResolvedValueOnce({
      maxProjects: 5,
      maxMembers: 5,
      maxTestCases: 100,
      maxTestRuns: 100,
      betaExpiresAt: PAST,
    });

    const result = await checkQuota(
      prisma as unknown as PrismaClient,
      "org-1",
      "projects",
    );

    expect(result).toEqual({ allowed: false, reason: "BETA_EXPIRED" });
    expect(prisma.project.count).not.toHaveBeenCalled();
  });

  it("allows when the current count is below the resource limit", async () => {
    const prisma = makePrisma();
    prisma.organization.findUnique.mockResolvedValueOnce({
      maxProjects: 5,
      maxMembers: 5,
      maxTestCases: 100,
      maxTestRuns: 100,
      betaExpiresAt: FUTURE,
    });
    prisma.project.count.mockResolvedValueOnce(3);

    const result = await checkQuota(
      prisma as unknown as PrismaClient,
      "org-1",
      "projects",
    );

    expect(result).toEqual({ allowed: true });
    expect(prisma.project.count).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
    });
  });

  it("blocks with QUOTA_EXCEEDED when the current count reaches the limit", async () => {
    const prisma = makePrisma();
    prisma.organization.findUnique.mockResolvedValueOnce({
      maxProjects: 5,
      maxMembers: 5,
      maxTestCases: 100,
      maxTestRuns: 100,
      betaExpiresAt: FUTURE,
    });
    prisma.project.count.mockResolvedValueOnce(5);

    const result = await checkQuota(
      prisma as unknown as PrismaClient,
      "org-1",
      "projects",
    );

    expect(result).toEqual({
      allowed: false,
      reason: "QUOTA_EXCEEDED",
      limit: 5,
      current: 5,
      resource: "projects",
    });
  });

  it.each([
    ["members", "organizationMember"],
    ["testCases", "testCase"],
    ["testRuns", "testRun"],
  ] as const)(
    "uses the %s counter for resource",
    async (resource, counterKey) => {
      const prisma = makePrisma();
      prisma.organization.findUnique.mockResolvedValueOnce({
        maxProjects: 100,
        maxMembers: 100,
        maxTestCases: 100,
        maxTestRuns: 100,
        betaExpiresAt: FUTURE,
      });
      prisma[counterKey].count.mockResolvedValueOnce(1);

      const result = await checkQuota(
        prisma as unknown as PrismaClient,
        "org-1",
        resource,
      );

      expect(result).toEqual({ allowed: true });
      expect(prisma[counterKey].count).toHaveBeenCalledTimes(1);
    },
  );
});
