import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import type { SignupRequestStatus } from "@/generated/prisma/client";

const VALID_STATUSES: ReadonlySet<SignupRequestStatus> = new Set([
  "pending",
  "approved",
  "rejected",
]);

export const GET = withAuth(
  PERMISSIONS.SIGNUP_REQUEST_LIST,
  async (req) => {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status") ?? "pending";

    const where =
      statusParam === "all"
        ? undefined
        : VALID_STATUSES.has(statusParam as SignupRequestStatus)
          ? { status: statusParam as SignupRequestStatus }
          : { status: "pending" as const };

    const items = await prisma.signupRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        organizationName: true,
        organizationSlug: true,
        provider: true,
        status: true,
        rejectionReason: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
        reviewedBy: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    return NextResponse.json({ items });
  },
);
