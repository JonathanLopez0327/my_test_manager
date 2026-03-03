import { getOrCreateAgentToken } from "./agent-token";
import { prisma } from "@/lib/prisma";
import { generateApiToken } from "@/lib/auth/api-token";
import { decryptToken, encryptToken } from "./token-crypto";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    apiToken: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/auth/api-token", () => ({
  generateApiToken: jest.fn(),
}));

jest.mock("./token-crypto", () => ({
  encryptToken: jest.fn(),
  decryptToken: jest.fn(),
}));

describe("agent-token", () => {
  const txMock = {
    apiToken: {
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AI_AGENT_TOKEN_TTL_DAYS = "90";
    process.env.AI_AGENT_TOKEN_ROTATE_BEFORE_DAYS = "7";

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
    );
  });

  it("reuses an existing valid agent token", async () => {
    (prisma.apiToken.findMany as jest.Mock).mockResolvedValue([
      { id: "token-1", expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) },
    ]);
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { api_token_id: "token-1", ciphertext: "cipher", iv: "iv", auth_tag: "tag", key_version: "v1" },
    ]);
    (decryptToken as jest.Mock).mockReturnValue("tms_existing");

    const result = await getOrCreateAgentToken({
      userId: "user-1",
      organizationId: "org-1",
    });

    expect(result).toBe("tms_existing");
    expect(generateApiToken).not.toHaveBeenCalled();
  });

  it("creates a new token when the stored secret is missing", async () => {
    (prisma.apiToken.findMany as jest.Mock).mockResolvedValue([
      { id: "token-1", expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) },
    ]);
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    (generateApiToken as jest.Mock).mockReturnValue({
      token: "tms_new",
      tokenHash: "hash",
      tokenPrefix: "tms_new_pref",
    });
    (encryptToken as jest.Mock).mockReturnValue({
      ciphertext: "cipher-new",
      iv: "iv-new",
      authTag: "tag-new",
      keyVersion: "v1",
    });
    txMock.apiToken.create.mockResolvedValue({ id: "token-2" });

    const result = await getOrCreateAgentToken({
      userId: "user-1",
      organizationId: "org-1",
    });

    expect(result).toBe("tms_new");
    expect(prisma.apiToken.updateMany).toHaveBeenCalled();
    expect(txMock.apiToken.create).toHaveBeenCalled();
    expect(txMock.$executeRaw).toHaveBeenCalled();
  });

  it("rotates token when close to expiration", async () => {
    (prisma.apiToken.findMany as jest.Mock).mockResolvedValue([
      { id: "token-1", expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
    ]);
    (generateApiToken as jest.Mock).mockReturnValue({
      token: "tms_rotated",
      tokenHash: "hash-rotated",
      tokenPrefix: "tms_rotated_pre",
    });
    (encryptToken as jest.Mock).mockReturnValue({
      ciphertext: "cipher-rotated",
      iv: "iv-rotated",
      authTag: "tag-rotated",
      keyVersion: "v1",
    });
    txMock.apiToken.create.mockResolvedValue({ id: "token-3" });

    const result = await getOrCreateAgentToken({
      userId: "user-1",
      organizationId: "org-1",
    });

    expect(result).toBe("tms_rotated");
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.apiToken.updateMany).toHaveBeenCalled();
    expect(txMock.apiToken.create).toHaveBeenCalled();
  });
});
