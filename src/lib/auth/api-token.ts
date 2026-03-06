import { createHash, randomBytes } from "crypto";

export const API_TOKEN_PREFIX = "tms_";
const TOKEN_SECRET_BYTES = 32;
const TOKEN_PREVIEW_LENGTH = 12;

export function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateApiToken(): {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const tokenSecret = randomBytes(TOKEN_SECRET_BYTES).toString("hex");
  const token = `${API_TOKEN_PREFIX}${tokenSecret}`;

  return {
    token,
    tokenHash: hashApiToken(token),
    tokenPrefix: token.slice(0, TOKEN_PREVIEW_LENGTH),
  };
}
