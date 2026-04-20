jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    userGlobalRole: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    organizationMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { authOptions } from "./auth";
import type { CredentialsConfig } from "next-auth/providers/credentials";

describe("authOptions callbacks", () => {
  const prismaMock = prisma as unknown as {
    user: { findUnique: jest.Mock };
    userGlobalRole: { findFirst: jest.Mock; findMany: jest.Mock };
    organizationMember: { findFirst: jest.Mock; findUnique: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.userGlobalRole.findFirst.mockResolvedValue(null);
    prismaMock.userGlobalRole.findMany.mockResolvedValue([]);
    prismaMock.organizationMember.findFirst.mockResolvedValue(null);
    prismaMock.organizationMember.findUnique.mockResolvedValue(null);
  });

  it("resolves jwt token.id from DB UUID for Google sign-in", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "0f6f0d20-22cb-4eb4-a7ef-e909d7571d4b",
      isActive: true,
    });

    const jwtCallback = authOptions.callbacks?.jwt;
    expect(jwtCallback).toBeDefined();

    const token = await jwtCallback!(
      {
        token: { email: "google.user@example.com" },
        user: undefined,
        account: { provider: "google" },
        profile: undefined,
        trigger: "signIn",
        session: undefined,
        isNewUser: false,
      } as never,
    );

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: "google.user@example.com" },
      select: { id: true, isActive: true },
    });
    expect(token.id).toBe("0f6f0d20-22cb-4eb4-a7ef-e909d7571d4b");
  });

  it("keeps credentials UUID on jwt callback", async () => {
    const jwtCallback = authOptions.callbacks?.jwt;
    expect(jwtCallback).toBeDefined();

    const token = await jwtCallback!(
      {
        token: {},
        user: { id: "b5fa0ee8-40d3-4213-9a5e-5f296f676db4", email: "cred@example.com" },
        account: { provider: "credentials" },
        profile: undefined,
        trigger: "signIn",
        session: undefined,
        isNewUser: false,
      } as never,
    );

    expect(token.id).toBe("b5fa0ee8-40d3-4213-9a5e-5f296f676db4");
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("credentials authorize", () => {
  const prismaMock = prisma as unknown as {
    user: { findUnique: jest.Mock };
    userGlobalRole: { findFirst: jest.Mock; findMany: jest.Mock };
    organizationMember: { findFirst: jest.Mock; findUnique: jest.Mock };
  };
  const compareMock = compare as unknown as jest.Mock;

  const credentialsProvider = authOptions.providers.find(
    (p) => (p as CredentialsConfig).id === "credentials",
  ) as CredentialsConfig;
  // NextAuth stores the user-provided authorize under `.options.authorize`
  // and exposes a no-op placeholder on the top-level `.authorize` field.
  const authorize = (credentialsProvider as unknown as {
    options: {
      authorize: (
        creds: { email: string; password: string } | undefined,
        req: unknown,
      ) => Promise<unknown>;
    };
  }).options.authorize;

  const creds = { email: "user@example.com", password: "correct-password" };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.userGlobalRole.findFirst.mockResolvedValue(null);
    prismaMock.organizationMember.findFirst.mockResolvedValue(null);
  });

  it("returns null when the email does not exist (no existence leak)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(authorize(creds, {} as never)).resolves.toBeNull();
    expect(compareMock).not.toHaveBeenCalled();
  });

  it("returns null when the password is wrong (generic failure)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: creds.email,
      passwordHash: "hash",
      isActive: true,
      fullName: "User",
    });
    compareMock.mockResolvedValue(false);

    await expect(authorize(creds, {} as never)).resolves.toBeNull();
  });

  it("throws account_inactive when the user row is inactive", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: creds.email,
      passwordHash: "hash",
      isActive: false,
      fullName: "User",
    });
    compareMock.mockResolvedValue(true);

    await expect(authorize(creds, {} as never)).rejects.toThrow("account_inactive");
  });

  it("throws organization_inactive when the user has no active org membership", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: creds.email,
      passwordHash: "hash",
      isActive: true,
      fullName: "User",
    });
    compareMock.mockResolvedValue(true);
    // userHasLoginAccess: no super_admin role, no active membership.
    prismaMock.userGlobalRole.findFirst.mockResolvedValue(null);
    prismaMock.organizationMember.findFirst.mockResolvedValue(null);

    await expect(authorize(creds, {} as never)).rejects.toThrow("organization_inactive");
  });

  it("returns the user when everything is active", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: creds.email,
      passwordHash: "hash",
      isActive: true,
      fullName: "User Name",
    });
    compareMock.mockResolvedValue(true);
    prismaMock.organizationMember.findFirst.mockResolvedValue({ organizationId: "org-1" });

    await expect(authorize(creds, {} as never)).resolves.toEqual({
      id: "u1",
      email: creds.email,
      name: "User Name",
    });
  });
});
