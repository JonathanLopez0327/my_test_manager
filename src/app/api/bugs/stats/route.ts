import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";

export const GET = withAuth(PERMISSIONS.BUG_LIST, async (_req, { userId, activeOrganizationId, organizationRole }) => {
  const filters: Prisma.BugWhereInput[] = [];

  // Scope to active organization
  if (activeOrganizationId) {
    filters.push({ project: { organizationId: activeOrganizationId } });
  }

  // Org owner/admin can see all bugs in their org; others need explicit membership
  if (!organizationRole || (organizationRole !== "owner" && organizationRole !== "admin")) {
    filters.push({
      project: {
        members: {
          some: { userId },
        },
      },
    });
  }

  const where: Prisma.BugWhereInput = filters.length
    ? { AND: filters }
    : {};

  const [
    total,
    openCount,
    inProgressCount,
    resolvedCount,
    verifiedCount,
    closedCount,
    reopenedCount,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    bugTypeCount,
    enhancementCount,
    taskCount,
  ] = await prisma.$transaction([
    prisma.bug.count({ where }),
    prisma.bug.count({ where: { ...where, status: "open" } }),
    prisma.bug.count({ where: { ...where, status: "in_progress" } }),
    prisma.bug.count({ where: { ...where, status: "resolved" } }),
    prisma.bug.count({ where: { ...where, status: "verified" } }),
    prisma.bug.count({ where: { ...where, status: "closed" } }),
    prisma.bug.count({ where: { ...where, status: "reopened" } }),
    prisma.bug.count({ where: { ...where, severity: "critical" } }),
    prisma.bug.count({ where: { ...where, severity: "high" } }),
    prisma.bug.count({ where: { ...where, severity: "medium" } }),
    prisma.bug.count({ where: { ...where, severity: "low" } }),
    prisma.bug.count({ where: { ...where, type: "bug" } }),
    prisma.bug.count({ where: { ...where, type: "enhancement" } }),
    prisma.bug.count({ where: { ...where, type: "task" } }),
  ]);

  return NextResponse.json({
    total,
    byStatus: {
      open: openCount,
      in_progress: inProgressCount,
      resolved: resolvedCount,
      verified: verifiedCount,
      closed: closedCount,
      reopened: reopenedCount,
    },
    bySeverity: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    },
    byType: {
      bug: bugTypeCount,
      enhancement: enhancementCount,
      task: taskCount,
    },
  });
});
