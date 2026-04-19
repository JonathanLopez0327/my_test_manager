import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SignUpError,
  createCredentialsSignupRequest,
  type SignUpErrorCode,
} from "@/lib/auth/sign-up";
import { signUpSchema } from "@/lib/schemas/sign-up";

type SignUpSuccessResponse = {
  ok: true;
  status: "pending";
  message: string;
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
    const parsed = signUpSchema.safeParse(await req.json());

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
