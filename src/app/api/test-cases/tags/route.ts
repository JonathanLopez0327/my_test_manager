import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";

export const GET = withAuth(
  PERMISSIONS.TEST_CASE_LIST,
  async (req, { userId, activeOrganizationId, organizationRole }) => {
    const { searchParams } = new URL(req.url);
    const suiteId = searchParams.get("suiteId")?.trim();

    const filters: Prisma.TestCaseWhereInput[] = [];

    if (activeOrganizationId) {
      filters.push({
        suite: {
          testPlan: {
            project: { organizationId: activeOrganizationId },
          },
        },
      });
    }

    if (suiteId) {
      filters.push({ suiteId });
    }

    if (
      !organizationRole ||
      (organizationRole !== "owner" && organizationRole !== "admin")
    ) {
      filters.push({
        suite: {
          testPlan: {
            project: {
              members: {
                some: { userId },
              },
            },
          },
        },
      });
    }

    const where: Prisma.TestCaseWhereInput = filters.length
      ? { AND: filters }
      : {};

    const rows = await prisma.testCase.findMany({
      where,
      select: { tags: true },
    });

    const items = Array.from(
      new Set(
        rows
          .flatMap((row) => row.tags)
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ items });
  },
);
