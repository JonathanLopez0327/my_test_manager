import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { SignUpError, rejectSignupRequest } from "@/lib/auth/sign-up";

type RejectBody = {
  reason?: string | null;
};

export const POST = withAuth(
  PERMISSIONS.SIGNUP_REQUEST_REVIEW,
  async (req, { userId }, { params }) => {
    const { id } = await params;

    let body: RejectBody = {};
    try {
      const raw = await req.text();
      body = raw ? (JSON.parse(raw) as RejectBody) : {};
    } catch {
      body = {};
    }

    const reason = typeof body.reason === "string" ? body.reason : null;

    try {
      const result = await rejectSignupRequest(id, userId, reason, prisma);
      return NextResponse.json({
        ok: true,
        requestId: result.requestId,
        status: result.status,
      });
    } catch (err) {
      if (err instanceof SignUpError) {
        return NextResponse.json(
          { ok: false, code: err.code, message: err.message },
          { status: err.status },
        );
      }
      console.error("[admin] rejectSignupRequest failed:", err);
      return NextResponse.json(
        {
          ok: false,
          code: "UNKNOWN_ERROR",
          message: "Could not reject the signup request. Please try again.",
        },
        { status: 500 },
      );
    }
  },
);
