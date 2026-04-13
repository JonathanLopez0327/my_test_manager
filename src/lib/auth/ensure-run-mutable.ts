import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const COMPLETED_RUN_LOCK_MESSAGE = "Completed runs cannot be modified.";

export async function ensureRunMutable(runId: string) {
  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });

  if (!run) {
    return NextResponse.json({ message: "Run not found." }, { status: 404 });
  }

  if (run.status === "completed") {
    return NextResponse.json(
      { message: COMPLETED_RUN_LOCK_MESSAGE },
      { status: 409 },
    );
  }

  return null;
}

