/** @jest-environment node */
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getLicenseQuotas, getLicenseState } from "@/lib/keygen/client";
import { invalidateLicenseStatusCache } from "@/lib/keygen/license-sync";
import { verifyKeygenWebhook } from "@/lib/keygen/verify-webhook";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    organization: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/keygen/client", () => ({
  getLicenseQuotas: jest.fn(),
  getLicenseState: jest.fn(),
}));

jest.mock("@/lib/keygen/license-sync", () => ({
  invalidateLicenseStatusCache: jest.fn(),
}));

jest.mock("@/lib/keygen/verify-webhook", () => ({
  verifyKeygenWebhook: jest.fn(),
}));

type PrismaMock = {
  organization: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const prismaMock = prisma as unknown as PrismaMock;
const getLicenseQuotasMock = getLicenseQuotas as jest.Mock;
const getLicenseStateMock = getLicenseState as jest.Mock;
const invalidateCacheMock = invalidateLicenseStatusCache as jest.Mock;
const verifyMock = verifyKeygenWebhook as jest.Mock;

const ORIGINAL_ENV = process.env;

function makeRequest(eventName: string, licenseId: string): Request {
  const payload = JSON.stringify({
    data: { type: "licenses", id: licenseId },
  });
  const envelope = {
    data: {
      id: "webhook-event-1",
      type: "webhook-events",
      attributes: { event: eventName, payload },
    },
  };
  return new Request("http://localhost/api/webhooks/keygen", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(envelope),
  });
}

function makeEntitlementRequest(eventName: string, entitlementId: string): Request {
  const payload = JSON.stringify({
    data: { type: "entitlements", id: entitlementId },
  });
  const envelope = {
    data: {
      id: "webhook-event-ent",
      type: "webhook-events",
      attributes: { event: eventName, payload },
    },
  };
  return new Request("http://localhost/api/webhooks/keygen", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(envelope),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    KEYGEN_WEBHOOK_PUBLIC_KEY: "-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----",
  };
  verifyMock.mockReturnValue({ ok: true });
  prismaMock.organization.findFirst.mockResolvedValue({ id: "org-1" });
  prismaMock.organization.findMany.mockResolvedValue([]);
  prismaMock.organization.update.mockResolvedValue({ id: "org-1" });
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/webhooks/keygen", () => {
  it("returns 500 when the public key env var is missing", async () => {
    delete process.env.KEYGEN_WEBHOOK_PUBLIC_KEY;
    const response = await POST(makeRequest("license.updated", "lic-1"));
    expect(response.status).toBe(500);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the signature is invalid", async () => {
    verifyMock.mockReturnValueOnce({ ok: false, reason: "bad signature" });
    const response = await POST(makeRequest("license.updated", "lic-1"));
    expect(response.status).toBe(401);
    expect(prismaMock.organization.findFirst).not.toHaveBeenCalled();
  });

  it("acks without action when the license is not linked to any organization", async () => {
    prismaMock.organization.findFirst.mockResolvedValueOnce(null);
    const response = await POST(makeRequest("license.updated", "lic-orphan"));
    const body = (await response.json()) as { ok: boolean };
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(prismaMock.organization.update).not.toHaveBeenCalled();
  });

  it("syncs quotas (including ai_token_limit_monthly) on license.updated", async () => {
    getLicenseQuotasMock.mockResolvedValueOnce({
      maxProjects: 10,
      maxMembers: 25,
      maxTestCases: 5000,
      maxTestRuns: 1000,
      aiTokenLimitMonthly: 5_000_000,
    });

    const response = await POST(makeRequest("license.updated", "lic-1"));

    expect(response.status).toBe(200);
    expect(getLicenseQuotasMock).toHaveBeenCalledWith("lic-1");
    expect(prismaMock.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: {
        maxProjects: 10,
        maxMembers: 25,
        maxTestCases: 5000,
        maxTestRuns: 1000,
        aiTokenLimitMonthly: 5_000_000,
      },
    });
    expect(invalidateCacheMock).toHaveBeenCalledWith("org-1");
  });

  it.each(["license.expired", "license.suspended"] as const)(
    "clears beta access on %s",
    async (eventName) => {
      const response = await POST(makeRequest(eventName, "lic-1"));
      expect(response.status).toBe(200);
      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: { betaExpiresAt: new Date(0) },
      });
      expect(invalidateCacheMock).toHaveBeenCalledWith("org-1");
      expect(getLicenseQuotasMock).not.toHaveBeenCalled();
    },
  );

  it.each(["license.reinstated", "license.renewed"] as const)(
    "restores betaExpiresAt from Keygen on %s",
    async (eventName) => {
      const newExpiry = new Date("2030-06-01T00:00:00Z");
      getLicenseStateMock.mockResolvedValueOnce({ status: "ACTIVE", expiry: newExpiry });

      const response = await POST(makeRequest(eventName, "lic-1"));

      expect(response.status).toBe(200);
      expect(getLicenseStateMock).toHaveBeenCalledWith("lic-1");
      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: { betaExpiresAt: newExpiry },
      });
      expect(invalidateCacheMock).toHaveBeenCalledWith("org-1");
    },
  );

  it("ignores events for non-license resource types", async () => {
    const payload = JSON.stringify({ data: { type: "policies", id: "pol-1" } });
    const envelope = {
      data: { id: "w1", type: "webhook-events", attributes: { event: "policy.updated", payload } },
    };
    const req = new Request("http://localhost/api/webhooks/keygen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
    });

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(prismaMock.organization.findFirst).not.toHaveBeenCalled();
  });

  it.each(["license.entitlements.attached", "license.entitlements.detached"] as const)(
    "resyncs quotas on %s (aliases license.updated)",
    async (eventName) => {
      getLicenseQuotasMock.mockResolvedValueOnce({
        maxProjects: 20,
        maxMembers: 50,
        maxTestCases: 10_000,
        maxTestRuns: 2_000,
        aiTokenLimitMonthly: 10_000_000,
      });

      const response = await POST(makeRequest(eventName, "lic-1"));

      expect(response.status).toBe(200);
      expect(getLicenseQuotasMock).toHaveBeenCalledWith("lic-1");
      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: {
          maxProjects: 20,
          maxMembers: 50,
          maxTestCases: 10_000,
          maxTestRuns: 2_000,
          aiTokenLimitMonthly: 10_000_000,
        },
      });
      expect(invalidateCacheMock).toHaveBeenCalledWith("org-1");
    },
  );

  it("fans out entitlement.updated to every linked organization", async () => {
    prismaMock.organization.findMany.mockResolvedValueOnce([
      { id: "org-a", keygenLicenseId: "lic-a" },
      { id: "org-b", keygenLicenseId: "lic-b" },
    ]);
    getLicenseQuotasMock
      .mockResolvedValueOnce({
        maxProjects: 10,
        maxMembers: 20,
        maxTestCases: 1000,
        maxTestRuns: 200,
        aiTokenLimitMonthly: 500_000,
      })
      .mockResolvedValueOnce({
        maxProjects: 15,
        maxMembers: 30,
        maxTestCases: 2000,
        maxTestRuns: 400,
        aiTokenLimitMonthly: 1_000_000,
      });

    const response = await POST(makeEntitlementRequest("entitlement.updated", "ent-1"));
    const body = (await response.json()) as { received: boolean; refreshed: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, refreshed: 2 });
    expect(prismaMock.organization.findMany).toHaveBeenCalledWith({
      where: { keygenLicenseId: { not: null } },
      select: { id: true, keygenLicenseId: true },
    });
    expect(getLicenseQuotasMock).toHaveBeenNthCalledWith(1, "lic-a");
    expect(getLicenseQuotasMock).toHaveBeenNthCalledWith(2, "lic-b");
    expect(prismaMock.organization.update).toHaveBeenCalledTimes(2);
    expect(invalidateCacheMock).toHaveBeenCalledWith("org-a");
    expect(invalidateCacheMock).toHaveBeenCalledWith("org-b");
    expect(prismaMock.organization.findFirst).not.toHaveBeenCalled();
  });

  it("continues refreshing remaining orgs when one license lookup fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.organization.findMany.mockResolvedValueOnce([
      { id: "org-a", keygenLicenseId: "lic-broken" },
      { id: "org-b", keygenLicenseId: "lic-ok" },
    ]);
    getLicenseQuotasMock
      .mockRejectedValueOnce(new Error("keygen 500"))
      .mockResolvedValueOnce({
        maxProjects: 5,
        maxMembers: 5,
        maxTestCases: 100,
        maxTestRuns: 100,
        aiTokenLimitMonthly: 250_000,
      });

    const response = await POST(makeEntitlementRequest("entitlement.updated", "ent-1"));
    const body = (await response.json()) as { received: boolean; refreshed: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, refreshed: 1 });
    expect(prismaMock.organization.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.organization.update).toHaveBeenCalledWith({
      where: { id: "org-b" },
      data: expect.objectContaining({ aiTokenLimitMonthly: 250_000 }),
    });
    expect(invalidateCacheMock).toHaveBeenCalledTimes(1);
    expect(invalidateCacheMock).toHaveBeenCalledWith("org-b");
    consoleSpy.mockRestore();
  });

  it("acks without action when entitlement.updated has no linked orgs", async () => {
    prismaMock.organization.findMany.mockResolvedValueOnce([]);

    const response = await POST(makeEntitlementRequest("entitlement.updated", "ent-1"));
    const body = (await response.json()) as { received: boolean; refreshed: number };

    expect(response.status).toBe(200);
    expect(body.refreshed).toBe(0);
    expect(getLicenseQuotasMock).not.toHaveBeenCalled();
    expect(prismaMock.organization.update).not.toHaveBeenCalled();
  });
});
