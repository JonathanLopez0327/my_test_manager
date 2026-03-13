import {
  createSlugCandidate,
  registerGoogleUserWithOrganization,
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
      betaCode: {
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

  it("creates user + organization for first Google sign-in", async () => {
    const txMock = {
      user: {
        create: jest.fn().mockResolvedValue({ id: "google-user-1" }),
      },
      organization: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: "google-org-1" }),
      },
      organizationMember: {
        create: jest.fn().mockResolvedValue({}),
      },
      betaCode: {
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

    const result = await registerGoogleUserWithOrganization(
      {
        email: "new.user@gmail.com",
        fullName: "New User",
      },
      prismaMock,
    );

    expect(result).toEqual({ userId: "google-user-1", created: true });
    expect(txMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new.user@gmail.com",
          fullName: "New User",
          isActive: true,
        }),
      }),
    );
    expect(txMock.organizationMember.create).toHaveBeenCalledWith({
      data: {
        organizationId: "google-org-1",
        userId: "google-user-1",
        role: "owner",
      },
    });
    expect(txMock.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: expect.stringMatching(/^New User [a-f0-9]{8}$/),
        }),
      }),
    );
  });

  it("reuses existing active user for Google sign-in", async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "existing-google-user", isActive: true }),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaClient;

    const result = await registerGoogleUserWithOrganization(
      {
        email: "existing@acme.com",
        fullName: "Existing User",
      },
      prismaMock,
    );

    expect(result).toEqual({ userId: "existing-google-user", created: false });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects inactive user for Google sign-in", async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "inactive-user", isActive: false }),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaClient;

    await expect(
      registerGoogleUserWithOrganization(
        {
          email: "inactive@acme.com",
          fullName: "Inactive User",
        },
        prismaMock,
      ),
    ).rejects.toMatchObject<Partial<SignUpError>>({
      code: "UNKNOWN_ERROR",
      status: 403,
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
