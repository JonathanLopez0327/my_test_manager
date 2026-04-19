import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { SignUpError, approveSignupRequest } from "@/lib/auth/sign-up";

export const POST = withAuth(
  PERMISSIONS.SIGNUP_REQUEST_REVIEW,
  async (_req, { userId }, { params }) => {
    const { id } = await params;

    try {
      const result = await approveSignupRequest(id, userId, prisma);
      return NextResponse.json({
        ok: true,
        userId: result.userId,
        organizationId: result.organizationId,
        organizationSlug: result.organizationSlug,
      });
    } catch (err) {
      if (err instanceof SignUpError) {
        return NextResponse.json(
          { ok: false, code: err.code, message: err.message },
          { status: err.status },
        );
      }
      console.error("[admin] approveSignupRequest failed:", err);
      return NextResponse.json(
        {
          ok: false,
          code: "UNKNOWN_ERROR",
          message: "Could not approve the signup request. Please try again.",
        },
        { status: 500 },
      );
    }
  },
);
