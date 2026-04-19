import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SignUpError,
  createCredentialsSignupRequest,
  createUserFromInvite,
  type SignUpErrorCode,
} from "@/lib/auth/sign-up";
import { signUpSchema } from "@/lib/schemas/sign-up";

type SignUpSuccessResponse =
  | {
      ok: true;
      status: "pending";
      message: string;
    }
  | {
      ok: true;
      status: "active";
      message: string;
      organizationSlug: string;
    };

type SignUpErrorResponse = {
  ok: false;
  code: SignUpErrorCode;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

type SignUpApiResponse = SignUpSuccessResponse | SignUpErrorResponse;

function json(body: SignUpApiResponse, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  try {
    const rawBody = (await req.json()) as { inviteToken?: unknown } & Record<
      string,
      unknown
    >;
    const inviteToken =
      typeof rawBody.inviteToken === "string" && rawBody.inviteToken.trim()
        ? rawBody.inviteToken.trim()
        : null;

    const parsed = signUpSchema.safeParse(rawBody);

    if (!parsed.success) {
      return json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "Invalid sign up payload.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        400,
      );
    }

    if (inviteToken) {
      const result = await createUserFromInvite(parsed.data, inviteToken, prisma);
      return json(
        {
          ok: true,
          status: "active",
          message: "Your account was created. You can now sign in.",
          organizationSlug: result.organizationSlug,
        },
        201,
      );
    }

    await createCredentialsSignupRequest(parsed.data, prisma);

    return json(
      {
        ok: true,
        status: "pending",
        message:
          "Your account request was submitted. A super admin will review it shortly.",
      },
      201,
    );
  } catch (error) {
    if (error instanceof SignUpError) {
      return json(
        {
          ok: false,
          code: error.code,
          message: error.message,
          fieldErrors: error.fieldErrors,
        },
        error.status,
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target
        : [];
      if (target.includes("email")) {
        return json(
          {
            ok: false,
            code: "EMAIL_TAKEN",
            message: "An account with that email already exists.",
            fieldErrors: {
              email: ["An account with that email already exists."],
            },
          },
          409,
        );
      }
    }

    return json(
      {
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "We could not submit your request. Please try again.",
      },
      500,
    );
  }
}
