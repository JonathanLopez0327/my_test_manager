import type { PrismaClient } from "@/generated/prisma/client";
import {
  createInvite,
  InviteError,
  readPendingInviteForSignup,
  revokeInvite,
  validateInviteToken,
  consumeInviteForUser,
} from "./invite-service";

function makePrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    organization: {
      findUnique: jest.fn(),
    },
    organizationMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
    },
    orgInvite: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    $transaction: jest.fn(async (fn) => {
      if (typeof fn === "function") {
        return fn({
          organizationMember: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
          orgInvite: {
            update: jest.fn(),
          },
        });
      }
      return undefined;
    }),
    ...overrides,
  } as unknown as PrismaClient;
}

describe("invite-service", () => {
  describe("createInvite", () => {
    it("throws ORG_NOT_FOUND if the org does not exist", async () => {
      const prisma = makePrismaMock();
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        createInvite(
          {
            organizationId: "org-1",
            email: "bob@acme.com",
            role: "member",
            invitedById: "user-1",
          },
          prisma,
        ),
      ).rejects.toMatchObject<Partial<InviteError>>({
        code: "ORG_NOT_FOUND",
        status: 404,
      });
    });

    it("rejects when email is not valid", async () => {
      const prisma = makePrismaMock();
      await expect(
        createInvite(
          {
            organizationId: "org-1",
            email: "not-an-email",
            role: "member",
            invitedById: "user-1",
          },
          prisma,
        ),
      ).rejects.toMatchObject<Partial<InviteError>>({
        code: "VALIDATION_ERROR",
      });
    });

    it("throws ALREADY_MEMBER if the email matches an existing member", async () => {
      const prisma = makePrismaMock();
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        id: "org-1",
        maxMembers: 5,
      });
      (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue({
        userId: "user-existing",
      });

      await expect(
        createInvite(
          {
            organizationId: "org-1",
            email: "bob@acme.com",
            role: "member",
            invitedById: "user-1",
          },
          prisma,
        ),
      ).rejects.toMatchObject<Partial<InviteError>>({
        code: "ALREADY_MEMBER",
        status: 409,
      });
    });

    it("throws PENDING_INVITE_EXISTS when a pending invite already exists", async () => {
      const prisma = makePrismaMock();
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        id: "org-1",
        maxMembers: 5,
      });
      (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.orgInvite.findFirst as jest.Mock).mockResolvedValue({
        id: "existing-invite",
      });

      await expect(
        createInvite(
          {
            organizationId: "org-1",
            email: "bob@acme.com",
            role: "member",
            invitedById: "user-1",
          },
          prisma,
        ),
      ).rejects.toMatchObject<Partial<InviteError>>({
        code: "PENDING_INVITE_EXISTS",
        status: 409,
      });
    });

    it("throws MEMBER_LIMIT_REACHED when member+pending count would exceed quota", async () => {
      const prisma = makePrismaMock();
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        id: "org-1",
        maxMembers: 3,
      });
      (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.orgInvite.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.organizationMember.count as jest.Mock).mockResolvedValue(2);
      (prisma.orgInvite.count as jest.Mock).mockResolvedValue(1);

      await expect(
        createInvite(
          {
            organizationId: "org-1",
            email: "bob@acme.com",
            role: "member",
            invitedById: "user-1",
          },
          prisma,
        ),
      ).rejects.toMatchObject<Partial<InviteError>>({
        code: "MEMBER_LIMIT_REACHED",
        status: 409,
      });
    });

    it("creates an invite with a token and normalized email", async () => {
      const prisma = makePrismaMock();
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        id: "org-1",
        maxMembers: 10,
      });
      (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.orgInvite.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.organizationMember.count as jest.Mock).mockResolvedValue(1);
      (prisma.orgInvite.count as jest.Mock).mockResolvedValue(0);
      (prisma.orgInvite.create as jest.Mock).mockImplementation(async ({ data }) => ({
        id: "invite-1",
        token: data.token,
        email: data.email,
        role: data.role,
        expiresAt: data.expiresAt,
      }));

      const result = await createInvite(
        {
          organizationId: "org-1",
          email: "  Bob@ACME.com  ",
          role: "admin",
          invitedById: "user-1",
        },
        prisma,
      );

      expect(result.email).toBe("bob@acme.com");
      expect(result.role).toBe("admin");
      expect(result.token).toHaveLength(43);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("validateInviteToken", () => {
    it("throws INVITE_NOT_FOUND when the token is unknown", async () => {
      const prisma = makePrismaMock();
      (prisma.orgInvite.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(validateInviteToken("nope", prisma)).rejects.toMatchObject<
        Partial<InviteError>
      >({ code: "INVITE_NOT_FOUND", status: 404 });
    });

    it("throws INVITE_EXPIRED and marks status=expired when past expiry", async () => {
      const prisma = makePrismaMock();
      (prisma.orgInvite.findUnique as jest.Mock).mockResolvedValue({
        id: "invite-1",
        email: "bob@acme.com",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() - 1000),
        organization: { id: "org-1", name: "Acme", slug: "acme" },
      });

      await expect(validateInviteToken("tok", prisma)).rejects.toMatchObject<
        Partial<InviteError>
      >({ code: "INVITE_EXPIRED", status: 410 });
      expect(prisma.orgInvite.update).toHaveBeenCalledWith({
        where: { id: "invite-1" },
        data: { status: "expired" },
      });
    });

    it("throws INVITE_NOT_PENDING for revoked invites", async () => {
      const prisma = makePrismaMock();
      (prisma.orgInvite.findUnique as jest.Mock).mockResolvedValue({
        id: "invite-1",
        email: "bob@acme.com",
        role: "member",
        status: "revoked",
        expiresAt: new Date(Date.now() + 1000),
        organization: { id: "org-1", name: "Acme", slug: "acme" },
      });

      await expect(validateInviteToken("tok", prisma)).rejects.toMatchObject<
        Partial<InviteError>
      >({ code: "INVITE_NOT_PENDING", status: 410 });
    });

    it("returns validation payload for a valid invite", async () => {
      const prisma = makePrismaMock();
      const expiresAt = new Date(Date.now() + 60_000);
      (prisma.orgInvite.findUnique as jest.Mock).mockResolvedValue({
        id: "invite-1",
        email: "bob@acme.com",
        role: "admin",
        status: "pending",
        expiresAt,
        organization: { id: "org-1", name: "Acme", slug: "acme" },
      });

      await expect(validateInviteToken("tok", prisma)).resolves.toEqual({
        id: "invite-1",
        email: "bob@acme.com",
        role: "admin",
        organizationId: "org-1",
        organizationName: "Acme",
        organizationSlug: "acme",
        expiresAt,
      });
    });
  });

  describe("consumeInviteForUser", () => {
    it("throws INVITE_EMAIL_MISMATCH when invite email differs from user email", async () => {
      const prisma = makePrismaMock();
      (prisma.orgInvite.findUnique as jest.Mock).mockResolvedValue({
        id: "invite-1",
        email: "bob@acme.com",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 60_000),
        organization: { id: "org-1", name: "Acme", slug: "acme" },
      });

      await expect(
        consumeInviteForUser("tok", "user-1", "someone-else@example.com", prisma),
      ).rejects.toMatchObject<Partial<InviteError>>({
        code: "INVITE_EMAIL_MISMATCH",
        status: 403,
      });
    });
  });

  describe("revokeInvite", () => {
    it("throws INVITE_NOT_FOUND when the invite belongs to a different org", async () => {
      const prisma = makePrismaMock();
      (prisma.orgInvite.findUnique as jest.Mock).mockResolvedValue({
        id: "invite-1",
        organizationId: "other-org",
        status: "pending",
      });

      await expect(
        revokeInvite("invite-1", "org-1", "user-1", prisma),
      ).rejects.toMatchObject<Partial<InviteError>>({
        code: "INVITE_NOT_FOUND",
      });
    });

    it("marks invite as revoked", async () => {
      const prisma = makePrismaMock();
      (prisma.orgInvite.findUnique as jest.Mock).mockResolvedValue({
        id: "invite-1",
        organizationId: "org-1",
        status: "pending",
      });

      await revokeInvite("invite-1", "org-1", "user-1", prisma);
      expect(prisma.orgInvite.update).toHaveBeenCalledWith({
        where: { id: "invite-1" },
        data: expect.objectContaining({
          status: "revoked",
          revokedById: "user-1",
        }),
      });
    });
  });

  describe("readPendingInviteForSignup", () => {
    it("throws INVITE_EMAIL_MISMATCH when signup email differs from invite email", async () => {
      const tx = {
        orgInvite: {
          findUnique: jest.fn().mockResolvedValue({
            id: "invite-1",
            email: "bob@acme.com",
            role: "member",
            status: "pending",
            expiresAt: new Date(Date.now() + 60_000),
            organization: { id: "org-1", slug: "acme" },
          }),
        },
      } as unknown as PrismaClient;

      await expect(
        readPendingInviteForSignup("tok", "other@example.com", tx),
      ).rejects.toMatchObject<Partial<InviteError>>({
        code: "INVITE_EMAIL_MISMATCH",
      });
    });

    it("returns invite data when token + email match", async () => {
      const tx = {
        orgInvite: {
          findUnique: jest.fn().mockResolvedValue({
            id: "invite-1",
            email: "bob@acme.com",
            role: "admin",
            status: "pending",
            expiresAt: new Date(Date.now() + 60_000),
            organization: { id: "org-1", slug: "acme" },
          }),
        },
      } as unknown as PrismaClient;

      const result = await readPendingInviteForSignup(
        "tok",
        "BOB@acme.com",
        tx,
      );
      expect(result).toEqual({
        id: "invite-1",
        organizationId: "org-1",
        organizationSlug: "acme",
        role: "admin",
      });
    });
  });
});
