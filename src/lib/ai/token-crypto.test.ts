import { decryptToken, encryptToken } from "./token-crypto";

describe("token-crypto", () => {
  const previousKey = process.env.AI_AGENT_TOKEN_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.AI_AGENT_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.AI_AGENT_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.AI_AGENT_TOKEN_ENCRYPTION_KEY = previousKey;
    }
  });

  it("encrypts and decrypts the same token", () => {
    const plain = "tms_secret_token";
    const encrypted = encryptToken(plain);
    const decrypted = decryptToken(encrypted);

    expect(decrypted).toBe(plain);
    expect(encrypted.keyVersion).toBe("v1");
  });

  it("fails when encryption key is invalid", () => {
    process.env.AI_AGENT_TOKEN_ENCRYPTION_KEY = Buffer.alloc(16, 7).toString("base64");

    expect(() => encryptToken("token")).toThrow(
      "AI_AGENT_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  });
});
