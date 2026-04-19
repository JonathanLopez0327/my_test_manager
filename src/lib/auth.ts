import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import type { GlobalRole, OrgRole } from "@/generated/prisma/client";
import { SignUpError, createGoogleSignupRequest } from "@/lib/auth/sign-up";

import { prisma } from "./prisma";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function userHasLoginAccess(userId: string): Promise<boolean> {
  const superAdmin = await prisma.userGlobalRole.findFirst({
    where: { userId, role: "super_admin" },
    select: { userId: true },
  });
  if (superAdmin) return true;

  const activeMembership = await prisma.organizationMember.findFirst({
    where: { userId, organization: { isActive: true } },
    select: { organizationId: true },
  });
  return Boolean(activeMembership);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password ?? "";

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isValid = await compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        if (!(await userHasLoginAccess(user.id))) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.fullName ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

      const resolvedEmail = (user.email ?? profile?.email)?.toLowerCase().trim();
      if (!resolvedEmail) {
        return "/login?error=google_no_email";
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: resolvedEmail },
        select: { id: true, isActive: true },
      });

      if (existingUser?.isActive && (await userHasLoginAccess(existingUser.id))) {
        user.id = existingUser.id;
        user.email = resolvedEmail;
        return true;
      }

      if (existingUser) {
        return "/login?error=account_inactive";
      }

      const pendingUrl = `/sign-up/pending?email=${encodeURIComponent(resolvedEmail)}`;

      try {
        await createGoogleSignupRequest(
          {
            email: resolvedEmail,
            fullName: user.name ?? profile?.name,
          },
          prisma,
        );
      } catch (err) {
        if (err instanceof SignUpError && err.code === "REQUEST_ALREADY_EXISTS") {
          return pendingUrl;
        }
        console.error("[auth] failed to queue Google signup request:", err);
        return "/login?error=signup_failed";
      }

      return pendingUrl;
    },
    async jwt({ token, user, trigger, session }) {
      // Credentials sign-in already returns DB UUID.
      if (user?.id && UUID_PATTERN.test(user.id)) {
        token.id = user.id;
      }

      // OAuth sign-in should always resolve token.id from DB by email.
      const needsUserLookup = !token.id || !UUID_PATTERN.test(String(token.id));
      const candidateEmail = (user?.email ?? token.email)?.toLowerCase().trim();
      if (needsUserLookup && candidateEmail) {
        const dbUser = await prisma.user.findUnique({
          where: { email: candidateEmail },
          select: { id: true, isActive: true },
        });

        if (!dbUser?.isActive) {
          return token;
        }

        token.id = dbUser.id;
      }

      if (token.id && !token.globalRoles) {
        const roles = await prisma.userGlobalRole.findMany({
          where: { userId: token.id as string },
          select: { role: true },
        });
        token.globalRoles = roles.map((item) => item.role);
      }

      const globalRoles = (token.globalRoles ?? []) as GlobalRole[];
      const isSuperAdmin = globalRoles.includes("super_admin");

      // super_admin does not belong to any organization;
      // skip org membership lookup and org switching entirely.
      if (!isSuperAdmin) {
        // Load active organization on first sign-in
        if (token.id && !token.activeOrganizationId) {
          const membership = await prisma.organizationMember.findFirst({
            where: {
              userId: token.id as string,
              organization: { isActive: true },
            },
            orderBy: { createdAt: "asc" },
            select: { organizationId: true, role: true },
          });
          if (membership) {
            token.activeOrganizationId = membership.organizationId;
            token.organizationRole = membership.role;
          }
        }

        if (token.id && token.activeOrganizationId && token.hasProjectAccess === undefined) {
          const projectMembership = await prisma.projectMember.findFirst({
            where: {
              userId: token.id as string,
              project: { organizationId: token.activeOrganizationId as string },
            },
            select: { projectId: true },
          });
          token.hasProjectAccess = Boolean(projectMembership);
        }

        // Handle profile name update via session update
        if (trigger === "update" && session?.name !== undefined) {
          token.name = session.name;
        }

        // Handle org switching via session update
        if (trigger === "update" && session?.activeOrganizationId) {
          const membership = await prisma.organizationMember.findUnique({
            where: {
              organizationId_userId: {
                organizationId: session.activeOrganizationId,
                userId: token.id as string,
              },
            },
            select: {
              organizationId: true,
              role: true,
              organization: { select: { isActive: true } },
            },
          });
          if (membership && membership.organization.isActive) {
            token.activeOrganizationId = membership.organizationId;
            token.organizationRole = membership.role;
            const projectMembership = await prisma.projectMember.findFirst({
              where: {
                userId: token.id as string,
                project: { organizationId: membership.organizationId },
              },
              select: { projectId: true },
            });
            token.hasProjectAccess = Boolean(projectMembership);
          }
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.globalRoles = (token.globalRoles ?? []) as GlobalRole[];
        session.user.activeOrganizationId = token.activeOrganizationId as string | undefined;
        session.user.organizationRole = token.organizationRole as OrgRole | undefined;
        session.user.hasProjectAccess = Boolean(token.hasProjectAccess);
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};


