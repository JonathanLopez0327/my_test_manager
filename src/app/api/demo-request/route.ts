import { NextResponse } from "next/server";
import {
  demoRequestSchema,
  type DemoRequestApiResponse,
} from "@/lib/schemas/demo-request";
import { clientIpFromHeaders, rateLimit } from "@/lib/api/rate-limit";

function json(body: DemoRequestApiResponse, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  const ip = clientIpFromHeaders(req.headers);
  const limited = rateLimit(
    { key: "demo-request", capacity: 5, refillPerSecond: 1 / 60 },
    ip,
  );
  if (!limited.allowed) {
    return json(
      {
        ok: false,
        message: "Too many requests. Please try again later.",
      },
      429,
    );
  }

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
