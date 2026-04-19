import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";
import { suspendLicense } from "@/lib/keygen/client";
import { invalidateLicenseStatusCache } from "@/lib/keygen/license-sync";

export const POST = withAuth(null, async (_req, { globalRoles }, { params }) => {
  if (!globalRoles.includes("super_admin")) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;

  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, keygenLicenseId: true },
  });

  if (!org) {
    return NextResponse.json({ message: "Organization not found." }, { status: 404 });
  }

  if (!org.keygenLicenseId) {
    return NextResponse.json(
      { message: "Organization has no Keygen license." },
      { status: 400 },
    );
  }

  try {
    const state = await suspendLicense(org.keygenLicenseId);

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: { betaExpiresAt: new Date(0) },
      select: { id: true, betaExpiresAt: true },
    });

    invalidateLicenseStatusCache(org.id);

    return NextResponse.json({
      id: updated.id,
      betaExpiresAt: updated.betaExpiresAt,
      status: state.status,
    });
  } catch (err) {
    console.error("[keygen] suspendLicense failed:", err);
    return NextResponse.json(
      { message: "Could not suspend license via Keygen." },
      { status: 502 },
    );
  }
});
