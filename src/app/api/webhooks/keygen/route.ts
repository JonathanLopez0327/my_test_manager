import { prisma } from "@/lib/prisma";
import { getLicenseQuotas } from "@/lib/keygen/client";

export async function POST(req: Request) {
  const event = await req.json();
  const licenseId: string | undefined = event.data?.id;

  if (!licenseId) {
    return Response.json({ ok: true });
  }

  const org = await prisma.organization.findFirst({
    where: { keygenLicenseId: licenseId },
    select: { id: true },
  });

  if (!org) {
    return Response.json({ ok: true });
  }

  if (event.type === "license.updated") {
    const quotas = await getLicenseQuotas(licenseId);
    await prisma.organization.update({
      where: { id: org.id },
      data: quotas,
    });
  }

  if (event.type === "license.expired" || event.type === "license.suspended") {
    await prisma.organization.update({
      where: { id: org.id },
      data: { betaExpiresAt: new Date(0) },
    });
  }

  return Response.json({ received: true });
}
