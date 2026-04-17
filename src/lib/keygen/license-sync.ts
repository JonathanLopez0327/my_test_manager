import { prisma } from "@/lib/prisma";
import { getLicenseState, type KeygenLicenseStatus } from "./client";

const CACHE_TTL_MS = 5 * 60 * 1000;
const EXPIRED_SENTINEL = new Date(0);

const cache = new Map<string, number>();

export type LicenseSyncResult = {
  expired: boolean;
  expiresAt: Date | null;
  status: KeygenLicenseStatus | "LOCAL_ONLY";
};

function isBlockingStatus(status: KeygenLicenseStatus): boolean {
  return status === "EXPIRED" || status === "SUSPENDED" || status === "BANNED";
}

function resolveLocal(betaExpiresAt: Date | null): LicenseSyncResult {
  const expired = !!betaExpiresAt && betaExpiresAt < new Date();
  return { expired, expiresAt: betaExpiresAt, status: "LOCAL_ONLY" };
}

export async function ensureLicenseStatus(
  organizationId: string,
): Promise<LicenseSyncResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { betaExpiresAt: true, keygenLicenseId: true },
  });

  if (!org) {
    return { expired: false, expiresAt: null, status: "LOCAL_ONLY" };
  }

  const now = Date.now();
  const cachedAt = cache.get(organizationId) ?? 0;
  if (now - cachedAt < CACHE_TTL_MS) {
    return resolveLocal(org.betaExpiresAt);
  }

  if (!org.keygenLicenseId) {
    cache.set(organizationId, now);
    return resolveLocal(org.betaExpiresAt);
  }

  try {
    const state = await getLicenseState(org.keygenLicenseId);
    cache.set(organizationId, now);

    if (isBlockingStatus(state.status)) {
      if (!org.betaExpiresAt || org.betaExpiresAt > new Date()) {
        await prisma.organization.update({
          where: { id: organizationId },
          data: { betaExpiresAt: EXPIRED_SENTINEL },
        });
      }
      return {
        expired: true,
        expiresAt: EXPIRED_SENTINEL,
        status: state.status,
      };
    }

    if (state.expiry) {
      const drift = Math.abs(
        (org.betaExpiresAt?.getTime() ?? 0) - state.expiry.getTime(),
      );
      if (drift > 1000) {
        await prisma.organization.update({
          where: { id: organizationId },
          data: { betaExpiresAt: state.expiry },
        });
      }
      return {
        expired: state.expiry < new Date(),
        expiresAt: state.expiry,
        status: state.status,
      };
    }

    return {
      expired: false,
      expiresAt: org.betaExpiresAt,
      status: state.status,
    };
  } catch (err) {
    console.error(
      "[keygen] getLicenseState failed, falling back to local state:",
      err,
    );
    return resolveLocal(org.betaExpiresAt);
  }
}

export function invalidateLicenseStatusCache(organizationId?: string): void {
  if (organizationId) {
    cache.delete(organizationId);
    return;
  }
  cache.clear();
}
