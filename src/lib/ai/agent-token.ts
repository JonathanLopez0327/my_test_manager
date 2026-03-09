import { prisma } from "@/lib/prisma";
import { generateApiToken } from "@/lib/auth/api-token";
import { decryptToken, encryptToken } from "./token-crypto";

const AGENT_TOKEN_NAME = "MTM AI Agent";
const DAY_MS = 24 * 60 * 60 * 1000;

type AgentTokenArgs = {
  userId: string;
  organizationId: string;
};

type SecretRow = {
  api_token_id: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: string;
};

type ActiveTokenRow = {
  id: string;
  expiresAt: Date | null;
};

type ApiTokenDelegateLike = {
  findMany?: (args: {
    where: {
      userId: string;
      organizationId: string;
      name: string;
      isActive: boolean;
      revokedAt: null;
      OR: Array<{ expiresAt: null } | { expiresAt: { gt: Date } }>;
    };
    orderBy: Array<{ createdAt: "desc" } | { id: "asc" }>;
    select: { id: true; expiresAt: true };
  }) => Promise<ActiveTokenRow[]>;
  updateMany?: (args: {
    where: {
      userId: string;
      organizationId: string;
      name: string;
      isActive: boolean;
      revokedAt: null;
    };
    data: {
      isActive: false;
      revokedAt: Date;
    };
  }) => Promise<unknown>;
  create?: (args: {
    data: {
      name: string;
      userId: string;
      organizationId: string;
      tokenHash: string;
      tokenPrefix: string;
      expiresAt: Date;
    };
    select: { id: true };
  }) => Promise<{ id: string }>;
};

type PrismaLike = {
  $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  apiToken?: Partial<ApiTokenDelegateLike>;
};

function getApiTokenDelegate(client: PrismaLike): ApiTokenDelegateLike | null {
  const candidate = client.apiToken;
  if (!candidate) return null;
  return candidate as ApiTokenDelegateLike;
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isRotatingSoon(expiresAt: Date | null, rotateBeforeDays: number, now: Date): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() - now.getTime() <= rotateBeforeDays * DAY_MS;
}

async function loadSecret(apiTokenId: string): Promise<SecretRow | null> {
  const rows = await prisma.$queryRaw<SecretRow[]>`
    SELECT api_token_id, ciphertext, iv, auth_tag, key_version
    FROM agent_token_secrets
    WHERE api_token_id = ${apiTokenId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function listActiveAgentTokens(
  userId: string,
  organizationId: string,
  now: Date,
): Promise<ActiveTokenRow[]> {
  const delegate = getApiTokenDelegate(prisma as unknown as PrismaLike);
  if (delegate && typeof delegate.findMany === "function") {
    return delegate.findMany({
      where: {
        userId,
        organizationId,
        name: AGENT_TOKEN_NAME,
        isActive: true,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        expiresAt: true,
      },
    });
  }

  const rows = await prisma.$queryRaw<Array<{ id: string; expires_at: Date | null }>>`
    SELECT id, expires_at
    FROM api_tokens
    WHERE user_id = ${userId}
      AND organization_id = ${organizationId}
      AND name = ${AGENT_TOKEN_NAME}
      AND is_active = true
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > ${now})
    ORDER BY created_at DESC, id ASC
  `;

  return rows.map((row) => ({ id: row.id, expiresAt: row.expires_at }));
}

async function revokeActiveAgentTokens(
  client: PrismaLike,
  userId: string,
  organizationId: string,
  revokedAt: Date,
) {
  const delegate = getApiTokenDelegate(client);
  if (delegate && typeof delegate.updateMany === "function") {
    await delegate.updateMany({
      where: {
        userId,
        organizationId,
        name: AGENT_TOKEN_NAME,
        isActive: true,
        revokedAt: null,
      },
      data: {
        isActive: false,
        revokedAt,
      },
    });
    return;
  }

  await client.$executeRaw`
    UPDATE api_tokens
    SET is_active = false, revoked_at = ${revokedAt}
    WHERE user_id = ${userId}
      AND organization_id = ${organizationId}
      AND name = ${AGENT_TOKEN_NAME}
      AND is_active = true
      AND revoked_at IS NULL
  `;
}

async function createTokenRecord(
  client: PrismaLike,
  userId: string,
  organizationId: string,
  tokenHash: string,
  tokenPrefix: string,
  expiresAt: Date,
): Promise<{ id: string }> {
  const delegate = getApiTokenDelegate(client);
  if (delegate && typeof delegate.create === "function") {
    return delegate.create({
      data: {
        name: AGENT_TOKEN_NAME,
        userId,
        organizationId,
        tokenHash,
        tokenPrefix,
        expiresAt,
      },
      select: { id: true },
    });
  }

  const rows = await client.$queryRaw<Array<{ id: string }>>`
    INSERT INTO api_tokens (
      name, token_prefix, token_hash, user_id, organization_id, is_active, expires_at
    )
    VALUES (
      ${AGENT_TOKEN_NAME}, ${tokenPrefix}, ${tokenHash}, ${userId}, ${organizationId}, true, ${expiresAt}
    )
    RETURNING id
  `;

  const created = rows[0];
  if (!created) {
    throw new Error("Could not create API tokens for the AI agent.");
  }

  return created;
}

async function createFreshAgentToken(
  userId: string,
  organizationId: string,
  ttlDays: number,
): Promise<string> {
  const generated = generateApiToken();
  const encrypted = encryptToken(generated.token);
  const expiresAt = new Date(Date.now() + ttlDays * DAY_MS);
  const revokedAt = new Date();
  const secretTimestamp = new Date();

  await prisma.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaLike;

    await revokeActiveAgentTokens(txClient, userId, organizationId, revokedAt);

    const created = await createTokenRecord(
      txClient,
      userId,
      organizationId,
      generated.tokenHash,
      generated.tokenPrefix,
      expiresAt,
    );

    await tx.$executeRaw`
      INSERT INTO agent_token_secrets (
        api_token_id, ciphertext, iv, auth_tag, key_version, created_at, updated_at
      )
      VALUES (
        ${created.id},
        ${encrypted.ciphertext},
        ${encrypted.iv},
        ${encrypted.authTag},
        ${encrypted.keyVersion},
        ${secretTimestamp},
        ${secretTimestamp}
      )
    `;
  });

  return generated.token;
}

async function revokeActiveAgentTokensFromRoot(userId: string, organizationId: string) {
  await revokeActiveAgentTokens(prisma as unknown as PrismaLike, userId, organizationId, new Date());
}

export async function getOrCreateAgentToken({
  userId,
  organizationId,
}: AgentTokenArgs): Promise<string> {
  const ttlDays = readPositiveIntEnv("AI_AGENT_TOKEN_TTL_DAYS", 90);
  const rotateBeforeDays = readPositiveIntEnv("AI_AGENT_TOKEN_ROTATE_BEFORE_DAYS", 7);
  const now = new Date();

  const activeTokens = await listActiveAgentTokens(userId, organizationId, now);

  for (const token of activeTokens) {
    if (isRotatingSoon(token.expiresAt, rotateBeforeDays, now)) {
      await revokeActiveAgentTokensFromRoot(userId, organizationId);
      break;
    }

    const secret = await loadSecret(token.id);
    if (!secret) {
      await revokeActiveAgentTokensFromRoot(userId, organizationId);
      break;
    }

    try {
      return decryptToken({
        ciphertext: secret.ciphertext,
        iv: secret.iv,
        authTag: secret.auth_tag,
        keyVersion: secret.key_version,
      });
    } catch {
      await revokeActiveAgentTokensFromRoot(userId, organizationId);
      break;
    }
  }

  return createFreshAgentToken(userId, organizationId, ttlDays);
}
