import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_VERSION = "v1";

export type EncryptedToken = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
};

function readEncryptionKey(): Buffer {
  const raw = process.env.AI_AGENT_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("Missing AI_AGENT_TOKEN_ENCRYPTION_KEY.");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("AI_AGENT_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }

  return key;
}

export function encryptToken(plainToken: string): EncryptedToken {
  const key = readEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGO, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plainToken, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion: KEY_VERSION,
  };
}

export function decryptToken(payload: EncryptedToken): string {
  const key = readEncryptionKey();
  const decipher = createDecipheriv(
    ENCRYPTION_ALGO,
    key,
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  const plain = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);

  return plain.toString("utf8");
}
