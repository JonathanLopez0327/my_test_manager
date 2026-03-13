import { NextResponse } from "next/server";
import type { PrismaClient } from "@/generated/prisma/client";

export type QuotaResource = "projects" | "members" | "testCases" | "testRuns";

export type QuotaResult =
  | { allowed: true }
  | { allowed: false; reason: "QUOTA_EXCEEDED"; limit: number; current: number; resource: QuotaResource }
  | { allowed: false; reason: "BETA_EXPIRED" };

export async function checkQuota(
  prisma: PrismaClient,
  organizationId: string,
  resource: QuotaResource,
): Promise<QuotaResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      maxProjects: true,
      maxMembers: true,
      maxTestCases: true,
      maxTestRuns: true,
      betaExpiresAt: true,
    },
  });

  if (!org) {
    return { allowed: true };
  }

  if (org.betaExpiresAt && org.betaExpiresAt < new Date()) {
    return { allowed: false, reason: "BETA_EXPIRED" };
  }

  let current: number;
  let limit: number;

  switch (resource) {
    case "projects": {
      limit = org.maxProjects;
      current = await prisma.project.count({ where: { organizationId } });
      break;
    }
    case "members": {
      limit = org.maxMembers;
      current = await prisma.organizationMember.count({ where: { organizationId } });
      break;
    }
    case "testCases": {
      limit = org.maxTestCases;
      current = await prisma.testCase.count({
        where: { suite: { testPlan: { project: { organizationId } } } },
      });
      break;
    }
    case "testRuns": {
      limit = org.maxTestRuns;
      current = await prisma.testRun.count({
        where: { project: { organizationId } },
      });
      break;
    }
  }

  if (current >= limit) {
    return { allowed: false, reason: "QUOTA_EXCEEDED", limit, current, resource };
  }

  return { allowed: true };
}

export function quotaExceededResponse(result: QuotaResult & { allowed: false }): NextResponse {
  if (result.reason === "BETA_EXPIRED") {
    return NextResponse.json(
      { code: "BETA_EXPIRED", message: "Your beta trial period has expired. Contact support to upgrade." },
      { status: 402 },
    );
  }

  const resourceLabel: Record<QuotaResource, string> = {
    projects: "projects",
    members: "organization members",
    testCases: "test cases",
    testRuns: "test runs",
  };

  return NextResponse.json(
    {
      code: "QUOTA_EXCEEDED",
      message: `Beta plan limit reached: you have ${result.current} of ${result.limit} ${resourceLabel[result.resource]}.`,
      limit: result.limit,
      current: result.current,
      resource: result.resource,
    },
    { status: 402 },
  );
}
