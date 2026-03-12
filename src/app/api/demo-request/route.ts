import { NextResponse } from "next/server";
import {
  demoRequestSchema,
  type DemoRequestApiResponse,
} from "@/lib/schemas/demo-request";

function json(body: DemoRequestApiResponse, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  try {
    const parsed = demoRequestSchema.safeParse(await req.json());

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

    // Mock endpoint for v1: enables local UX validation without persistence.
    const simulateFailure = parsed.data.email.toLowerCase().includes("+fail@");
    if (simulateFailure) {
      return json(
        {
          ok: false,
          message: "We could not submit your request. Please try again.",
        },
        500,
      );
    }

    return json({
      ok: true,
      message: "Thanks! We received your request and will contact you soon.",
    });
  } catch {
    return json(
      {
        ok: false,
        message: "We could not process your request. Please try again.",
      },
      500,
    );
  }
}
