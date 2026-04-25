import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  InviteError,
  validateInviteToken,
} from "@/lib/invites/invite-service";

/**
 * Public endpoint — returns invite metadata so the `/invite/[token]` landing
 * page can render org name, invited email, and role. Does NOT consume the
 * invite and does NOT require authentication.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  try {
    const invite = await validateInviteToken(token, prisma);
    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      organization: {
        id: invite.organizationId,
        name: invite.organizationName,
        slug: invite.organizationSlug,
      },
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    if (error instanceof InviteError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[invites] validate failed", error);
    return NextResponse.json(
      { message: "Could not load the invite." },
      { status: 500 },
    );
  }
}
