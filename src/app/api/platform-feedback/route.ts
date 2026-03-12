import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  platformFeedbackSchema,
  type PlatformFeedbackApiResponse,
} from "@/lib/schemas/platform-feedback";

function json(body: PlatformFeedbackApiResponse, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  try {
    const parsed = platformFeedbackSchema.safeParse(await req.json());

    if (!parsed.success) {
      return json(
        {
          ok: false,
          message: "Invalid request payload.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        400,
      );
    }

    await prisma.platformFeedback.create({
      data: {
        name: parsed.data.name ?? null,
        email: parsed.data.email ?? null,
        rating: parsed.data.rating,
        message: parsed.data.message,
      },
    });

    return json(
      {
        ok: true,
        message: "Thanks! Your feedback has been submitted.",
      },
      201,
    );
  } catch {
    return json(
      {
        ok: false,
        message: "We could not submit your feedback. Please try again.",
      },
      500,
    );
  }
}
