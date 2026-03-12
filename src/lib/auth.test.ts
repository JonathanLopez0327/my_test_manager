jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    userGlobalRole: {
      findMany: jest.fn(),
    },
    organizationMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { authOptions } from "./auth";

describe("authOptions callbacks", () => {
  const prismaMock = prisma as unknown as {
    user: { findUnique: jest.Mock };
    userGlobalRole: { findMany: jest.Mock };
    organizationMember: { findFirst: jest.Mock; findUnique: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
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
