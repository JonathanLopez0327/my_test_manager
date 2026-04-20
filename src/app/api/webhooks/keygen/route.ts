import { prisma } from "@/lib/prisma";
import { getLicenseQuotas, getLicenseState } from "@/lib/keygen/client";
import { invalidateLicenseStatusCache } from "@/lib/keygen/license-sync";
import { verifyKeygenWebhook } from "@/lib/keygen/verify-webhook";

export const runtime = "nodejs";

type WebhookEnvelope = {
  data?: {
    id?: string;
    type?: string;
    attributes?: {
      event?: string;
      payload?: string;
    };
  };
};

type PayloadResource = {
  data?: {
    id?: string;
    type?: string;
  };
};

function extractEvent(rawBody: string): {
  eventName: string | null;
  resourceType: string | null;
  resourceId: string | null;
  webhookEventId: string | null;
} {
  let envelope: WebhookEnvelope;
  try {
    envelope = JSON.parse(rawBody) as WebhookEnvelope;
  } catch {
    return {
      eventName: null,
      resourceType: null,
      resourceId: null,
      webhookEventId: null,
    };
  }

  const eventName = envelope.data?.attributes?.event ?? null;
  const webhookEventId = envelope.data?.id ?? null;
  const payloadStr = envelope.data?.attributes?.payload ?? null;

  if (!payloadStr) {
    return { eventName, resourceType: null, resourceId: null, webhookEventId };
  }

  let resource: PayloadResource;
  try {
    resource = JSON.parse(payloadStr) as PayloadResource;
  } catch {
    return { eventName, resourceType: null, resourceId: null, webhookEventId };
  }

  return {
    eventName,
    resourceType: resource.data?.type ?? null,
    resourceId: resource.data?.id ?? null,
    webhookEventId,
  };
}

export async function POST(req: Request) {
  const publicKeyPem = process.env.KEYGEN_WEBHOOK_PUBLIC_KEY;
  if (!publicKeyPem) {
    console.error("[keygen] KEYGEN_WEBHOOK_PUBLIC_KEY is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  const rawBody = await req.text();
  const verification = verifyKeygenWebhook({
    method: req.method,
    url: req.url,
    headers: req.headers,
    rawBody,
    publicKeyPem,
  });

  if (!verification.ok) {
    console.warn(`[keygen] webhook rejected: ${verification.reason}`);
    return new Response("Unauthorized", { status: 401 });
  }

  const { eventName, resourceType, resourceId, webhookEventId } =
    extractEvent(rawBody);

  console.info(
    `[keygen] webhook received event=${eventName} resourceType=${resourceType} resourceId=${resourceId} webhookEventId=${webhookEventId}`,
  );

  // Entitlement-scoped events carry the entitlement id, not a license id.
  // Keygen does not fire a per-license event when an entitlement's metadata
  // changes, so we fan out and re-sync every linked org.
  if (resourceType === "entitlements" && eventName === "entitlement.updated") {
    const linkedOrgs = await prisma.organization.findMany({
      where: { keygenLicenseId: { not: null } },
      select: { id: true, keygenLicenseId: true },
    });

    let refreshed = 0;
    for (const linked of linkedOrgs) {
      if (!linked.keygenLicenseId) continue;
      try {
        const quotas = await getLicenseQuotas(linked.keygenLicenseId);
        await prisma.organization.update({
          where: { id: linked.id },
          data: quotas,
        });
        invalidateLicenseStatusCache(linked.id);
        refreshed += 1;
      } catch (error) {
        console.error(
          `[keygen] entitlement refresh failed for org=${linked.id} license=${linked.keygenLicenseId}`,
          error,
        );
      }
    }

    console.info(`[keygen] entitlement.updated refreshed ${refreshed}/${linkedOrgs.length} orgs`);
    return Response.json({ received: true, refreshed });
  }

  if (!eventName || resourceType !== "licenses" || !resourceId) {
    return Response.json({ ok: true });
  }

  const org = await prisma.organization.findFirst({
    where: { keygenLicenseId: resourceId },
    select: { id: true },
  });

  if (!org) {
    return Response.json({ ok: true });
  }

  const LICENSE_RESYNC_EVENTS = new Set([
    "license.updated",
    "license.entitlements.attached",
    "license.entitlements.detached",
  ]);

  if (LICENSE_RESYNC_EVENTS.has(eventName)) {
    const quotas = await getLicenseQuotas(resourceId);
    await prisma.organization.update({
      where: { id: org.id },
      data: quotas,
    });
    invalidateLicenseStatusCache(org.id);
  }

  if (eventName === "license.expired" || eventName === "license.suspended") {
    await prisma.organization.update({
      where: { id: org.id },
      data: { betaExpiresAt: new Date(0) },
    });
    invalidateLicenseStatusCache(org.id);
  }

  if (eventName === "license.reinstated" || eventName === "license.renewed") {
    const state = await getLicenseState(resourceId);
    await prisma.organization.update({
      where: { id: org.id },
      data: { betaExpiresAt: state.expiry },
    });
    invalidateLicenseStatusCache(org.id);
  }

  return Response.json({ received: true });
}
