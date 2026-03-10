import {
  createSlugCandidate,
  registerUserWithOrganization,
  resolveUniqueSlug,
  SignUpError,
} from "./sign-up";
import type { PrismaClient } from "@/generated/prisma/client";

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
}));

describe("sign-up service", () => {
  it("creates fallback slug candidate from organization name", () => {
    expect(createSlugCandidate("Compañía QA", undefined)).toBe("compania-qa");
  });

  it("resolves unique slug with numeric suffix", () => {
    expect(resolveUniqueSlug("acme", ["acme", "acme-2", "acme-3"])).toBe("acme-4");
  });

  it("throws EMAIL_TAKEN when user already exists", async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "existing-user" }),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaClient;

    await expect(
      registerUserWithOrganization(
        {
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@acme.com",
          password: "password123",
          organization: { name: "Acme QA", slug: "acme-qa" },
        },
        prismaMock,
      ),
    ).rejects.toMatchObject<Partial<SignUpError>>({
      code: "EMAIL_TAKEN",
      status: 409,
    });
  });

  it("creates user, organization and owner membership in one transaction", async () => {
    const txMock = {
      user: {
        create: jest.fn().mockResolvedValue({ id: "user-1" }),
      },
      organization: {
        findMany: jest.fn().mockResolvedValue([{ slug: "acme" }]),
        create: jest.fn().mockResolvedValue({ id: "org-1", slug: "acme-2" }),
      },
      organizationMember: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
        callback(txMock),
      ),
    } as unknown as PrismaClient;

    const result = await registerUserWithOrganization(
      {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@acme.com",
        password: "password123",
        organization: { name: "Acme", slug: "acme" },
      },
      prismaMock,
    );

    expect(result).toEqual({
      userId: "user-1",
      organizationId: "org-1",
      organizationSlug: "acme-2",
      organizationRole: "owner",
    });
    expect(txMock.user.create).toHaveBeenCalled();
    expect(txMock.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: "user-1",
        }),
      }),
    );
    expect(txMock.organizationMember.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        userId: "user-1",
        role: "owner",
      },
    });
  });
});
