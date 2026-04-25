import { NextResponse } from "next/server";
import type { PrismaClient } from "@/generated/prisma/client";
import { ensureLicenseStatus } from "@/lib/keygen/license-sync";

export type QuotaResource = "projects" | "members" | "testCases" | "testRuns" | "artifactBytes";

export type QuotaCheckOptions = {
  // Bytes the caller is about to add — counted into `current` so we reject
  // *before* the upload exceeds the limit, not after.
  addBytes?: number | bigint;
};

export type QuotaResult =
  | { allowed: true }
  | { allowed: false; reason: "QUOTA_EXCEEDED"; limit: number; current: number; resource: QuotaResource }
  | { allowed: false; reason: "BETA_EXPIRED" };

export async function checkQuota(
  prisma: PrismaClient,
  organizationId: string,
  resource: QuotaResource,
  options: QuotaCheckOptions = {},
): Promise<QuotaResult> {
  await ensureLicenseStatus(organizationId);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      maxProjects: true,
      maxMembers: true,
      maxTestCases: true,
      maxTestRuns: true,
      maxArtifactBytes: true,
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
    case "artifactBytes": {
      limit = Number(org.maxArtifactBytes);
      const [runAgg, bugAgg] = await prisma.$transaction([
        prisma.testRunArtifact.aggregate({
          _sum: { sizeBytes: true },
          where: { run: { project: { organizationId } } },
        }),
        prisma.bugAttachment.aggregate({
          _sum: { sizeBytes: true },
          where: { bug: { project: { organizationId } } },
        }),
      ]);
      const runBytes = runAgg._sum.sizeBytes ? Number(runAgg._sum.sizeBytes) : 0;
      const bugBytes = bugAgg._sum.sizeBytes ? Number(bugAgg._sum.sizeBytes) : 0;
      const stored = runBytes + bugBytes;
      const incoming = options.addBytes ? Number(options.addBytes) : 0;
      current = stored + incoming;
      break;
    }
  }

  if (current >= limit) {
    return { allowed: false, reason: "QUOTA_EXCEEDED", limit, current, resource };
  }

  return { allowed: true };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function quotaExceededResponse(result: QuotaResult & { allowed: false }): NextResponse {
  if (result.reason === "BETA_EXPIRED") {
    return NextResponse.json(
      { code: "BETA_EXPIRED", message: "Your beta trial period has expired. Contact support to upgrade." },
      { status: 402 },
    );
  }

  if (result.resource === "artifactBytes") {
    return NextResponse.json(
      {
        code: "QUOTA_EXCEEDED",
        message: `Beta plan storage limit reached: ${formatBytes(result.current)} of ${formatBytes(result.limit)} of artifact storage in use.`,
        limit: result.limit,
        current: result.current,
        resource: result.resource,
      },
      { status: 402 },
    );
  }

  const resourceLabel: Record<Exclude<QuotaResource, "artifactBytes">, string> = {
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
