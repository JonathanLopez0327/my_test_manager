import {
  approveSignupRequest,
  createCredentialsSignupRequest,
  createGoogleSignupRequest,
  createSlugCandidate,
  rejectSignupRequest,
  resolveUniqueSlug,
  SignUpError,
} from "./sign-up";
import type { PrismaClient } from "@/generated/prisma/client";

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
}));

jest.mock("@/lib/keygen/client", () => ({
  createKeygenUser: jest.fn().mockResolvedValue("keygen-user-1"),
  createKeygenLicense: jest.fn().mockResolvedValue("keygen-license-1"),
  getLicenseQuotas: jest.fn().mockResolvedValue({
    maxProjects: 3,
    maxMembers: 5,
    maxTestCases: 200,
    maxTestRuns: 100,
  }),
  deleteKeygenUser: jest.fn().mockResolvedValue(undefined),
  deleteKeygenLicense: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  process.env.KEYGEN_POLICY_BETA_ID = "policy-test-id";
});

describe("sign-up service", () => {
  describe("slug helpers", () => {
    it("creates fallback slug candidate from organization name", () => {
      expect(createSlugCandidate("Compañía QA", undefined)).toBe("compania-qa");
    });

    it("resolves unique slug with numeric suffix", () => {
      expect(resolveUniqueSlug("acme", ["acme", "acme-2", "acme-3"])).toBe(
        "acme-4",
      );
    });
  });

  describe("createCredentialsSignupRequest", () => {
    it("throws EMAIL_TAKEN when a user already exists", async () => {
      const prismaMock = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: "existing-user" }),
        },
        signupRequest: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
      } as unknown as PrismaClient;

      await expect(
        createCredentialsSignupRequest(
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

    it("throws REQUEST_ALREADY_EXISTS when a pending request exists", async () => {
      const prismaMock = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        signupRequest: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: "req-1", status: "pending" }),
          create: jest.fn(),
          update: jest.fn(),
        },
      } as unknown as PrismaClient;

      await expect(
        createCredentialsSignupRequest(
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
        code: "REQUEST_ALREADY_EXISTS",
        status: 409,
      });
    });

    it("creates a new signup request when email is available", async () => {
      const createMock = jest.fn().mockResolvedValue({
        id: "req-new",
        status: "pending",
      });
      const prismaMock = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        signupRequest: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: createMock,
          update: jest.fn(),
        },
      } as unknown as PrismaClient;

      const result = await createCredentialsSignupRequest(
        {
          firstName: "Jane",
          lastName: "Doe",
          email: "JANE@acme.com",
          password: "password123",
          organization: { name: "Acme QA", slug: "acme-qa" },
        },
        prismaMock,
      );

      expect(result).toEqual({ requestId: "req-new", status: "pending" });
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "jane@acme.com",
            firstName: "Jane",
            lastName: "Doe",
            passwordHash: "hashed-password",
            organizationName: "Acme QA",
            organizationSlug: "acme-qa",
            provider: "credentials",
          }),
        }),
      );
    });

    it("re-opens a previously rejected request", async () => {
      const updateMock = jest.fn().mockResolvedValue({
        id: "req-rejected",
        status: "pending",
      });
      const prismaMock = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        signupRequest: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: "req-rejected", status: "rejected" }),
          create: jest.fn(),
          update: updateMock,
        },
      } as unknown as PrismaClient;

      const result = await createCredentialsSignupRequest(
        {
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@acme.com",
          password: "password123",
          organization: { name: "Acme QA", slug: "acme-qa" },
        },
        prismaMock,
      );

      expect(result).toEqual({ requestId: "req-rejected", status: "pending" });
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req-rejected" },
          data: expect.objectContaining({
            status: "pending",
            provider: "credentials",
            rejectionReason: null,
            reviewedById: null,
            reviewedAt: null,
          }),
        }),
      );
    });
  });

  describe("createGoogleSignupRequest", () => {
    it("creates a pending Google request with derived organization name", async () => {
      const createMock = jest.fn().mockResolvedValue({
        id: "req-g",
        status: "pending",
      });
      const prismaMock = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        signupRequest: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: createMock,
          update: jest.fn(),
        },
      } as unknown as PrismaClient;

      const result = await createGoogleSignupRequest(
        { email: "new.user@gmail.com", fullName: "New User" },
        prismaMock,
      );

      expect(result).toEqual({ requestId: "req-g", status: "pending" });
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "new.user@gmail.com",
            firstName: "New",
            lastName: "User",
            passwordHash: null,
            provider: "google",
            organizationName: expect.stringMatching(/^New User [a-f0-9]{8}$/),
          }),
        }),
      );
    });

    it("throws EMAIL_TAKEN when the email already belongs to an account", async () => {
      const prismaMock = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: "existing" }),
        },
        signupRequest: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
      } as unknown as PrismaClient;

      await expect(
        createGoogleSignupRequest(
          { email: "existing@acme.com", fullName: "Existing User" },
          prismaMock,
        ),
      ).rejects.toMatchObject<Partial<SignUpError>>({
        code: "EMAIL_TAKEN",
        status: 409,
      });
    });
  });

  describe("approveSignupRequest", () => {
    it("provisions a user, organization and owner membership", async () => {
      const txMock = {
        user: {
          create: jest.fn().mockResolvedValue({ id: "user-1" }),
        },
        organization: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest
            .fn()
            .mockResolvedValue({ id: "org-1", slug: "acme-qa" }),
        },
        organizationMember: {
          create: jest.fn().mockResolvedValue({}),
        },
        betaCode: {
          create: jest.fn().mockResolvedValue({}),
        },
        signupRequest: {
          update: jest.fn().mockResolvedValue({}),
        },
      };

      const prismaMock = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        signupRequest: {
          findUnique: jest.fn().mockResolvedValue({
            id: "req-1",
            email: "jane@acme.com",
            firstName: "Jane",
            lastName: "Doe",
            passwordHash: "stored-hash",
            organizationName: "Acme QA",
            organizationSlug: "acme-qa",
            provider: "credentials",
            status: "pending",
          }),
        },
        $transaction: jest.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) =>
          cb(txMock),
        ),
      } as unknown as PrismaClient;

      const result = await approveSignupRequest(
        "req-1",
        "reviewer-1",
        prismaMock,
      );

      expect(result).toEqual({
        userId: "user-1",
        organizationId: "org-1",
        organizationSlug: "acme-qa",
        organizationRole: "owner",
      });
      expect(txMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "jane@acme.com",
            fullName: "Jane Doe",
            passwordHash: "stored-hash",
            isActive: true,
          }),
        }),
      );
      expect(txMock.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Acme QA",
            createdBy: { connect: { id: "user-1" } },
            keygenUserId: "keygen-user-1",
            keygenLicenseId: "keygen-license-1",
          }),
        }),
      );
      expect(txMock.organizationMember.create).toHaveBeenCalledWith({
        data: {
          organization: { connect: { id: "org-1" } },
          user: { connect: { id: "user-1" } },
          role: "owner",
        },
      });
      expect(txMock.signupRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req-1" },
          data: expect.objectContaining({
            status: "approved",
            reviewedById: "reviewer-1",
          }),
        }),
      );
    });

    it("throws REQUEST_NOT_FOUND when id does not exist", async () => {
      const prismaMock = {
        signupRequest: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      } as unknown as PrismaClient;

      await expect(
        approveSignupRequest("missing", "reviewer-1", prismaMock),
      ).rejects.toMatchObject<Partial<SignUpError>>({
        code: "REQUEST_NOT_FOUND",
        status: 404,
      });
    });

    it("throws REQUEST_NOT_PENDING when already reviewed", async () => {
      const prismaMock = {
        signupRequest: {
          findUnique: jest.fn().mockResolvedValue({
            id: "req-1",
            email: "jane@acme.com",
            firstName: "Jane",
            lastName: "Doe",
            passwordHash: "stored-hash",
            organizationName: "Acme QA",
            organizationSlug: null,
            provider: "credentials",
            status: "approved",
          }),
        },
      } as unknown as PrismaClient;

      await expect(
        approveSignupRequest("req-1", "reviewer-1", prismaMock),
      ).rejects.toMatchObject<Partial<SignUpError>>({
        code: "REQUEST_NOT_PENDING",
        status: 409,
      });
    });
  });

  describe("rejectSignupRequest", () => {
    it("marks the request as rejected with reviewer and reason", async () => {
      const updateMock = jest
        .fn()
        .mockResolvedValue({ id: "req-1", status: "rejected" });
      const prismaMock = {
        signupRequest: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: "req-1", status: "pending" }),
          update: updateMock,
        },
      } as unknown as PrismaClient;

      const result = await rejectSignupRequest(
        "req-1",
        "reviewer-1",
        "Not a legitimate business",
        prismaMock,
      );

      expect(result).toEqual({ requestId: "req-1", status: "rejected" });
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req-1" },
          data: expect.objectContaining({
            status: "rejected",
            reviewedById: "reviewer-1",
            rejectionReason: "Not a legitimate business",
          }),
        }),
      );
    });

    it("throws REQUEST_NOT_PENDING when the request was already resolved", async () => {
      const prismaMock = {
        signupRequest: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: "req-1", status: "rejected" }),
          update: jest.fn(),
        },
      } as unknown as PrismaClient;

      await expect(
        rejectSignupRequest("req-1", "reviewer-1", null, prismaMock),
      ).rejects.toMatchObject<Partial<SignUpError>>({
        code: "REQUEST_NOT_PENDING",
        status: 409,
      });
    });
  });
});
