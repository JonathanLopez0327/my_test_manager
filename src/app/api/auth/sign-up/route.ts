import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SignUpError,
  registerUserWithOrganization,
} from "@/lib/auth/sign-up";
import { signUpSchema } from "@/lib/schemas/sign-up";

type SignUpSuccessResponse = {
  ok: true;
  message: string;
  organization: {
    id: string;
    slug: string;
  };
};

type SignUpErrorResponse = {
  ok: false;
  code: "VALIDATION_ERROR" | "EMAIL_TAKEN" | "UNKNOWN_ERROR";
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

    const created = await registerUserWithOrganization(parsed.data, prisma);

    return json(
      {
        ok: true,
        message: "Account created successfully.",
        organization: {
          id: created.organizationId,
          slug: created.organizationSlug,
        },
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

    // Fallback for race conditions on unique constraints.
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
            fieldErrors: { email: ["An account with that email already exists."] },
          },
          409,
        );
      }
    }

    return json(
      {
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "We could not create your account. Please try again.",
      },
      500,
    );
  }
}
