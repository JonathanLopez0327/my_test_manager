import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import type { GlobalRole, OrgRole } from "@/generated/prisma/client";

import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
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

        return {
          id: user.id,
          email: user.email,
          name: user.fullName ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign-in: populate token with user data
      if (user?.id) {
        token.id = user.id;
      }

      // Load global roles on first sign-in
      if (token.id && !token.globalRoles) {
        const roles = await prisma.userGlobalRole.findMany({
          where: { userId: token.id as string },
          select: { role: true },
        });
        token.globalRoles = roles.map((item) => item.role);
      }

      // Load active organization on first sign-in
      if (token.id && !token.activeOrganizationId) {
        const membership = await prisma.organizationMember.findFirst({
          where: { userId: token.id as string },
          orderBy: { createdAt: "asc" },
          select: { organizationId: true, role: true },
        });
        if (membership) {
          token.activeOrganizationId = membership.organizationId;
          token.organizationRole = membership.role;
        }
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
          select: { organizationId: true, role: true },
        });
        if (membership) {
          token.activeOrganizationId = membership.organizationId;
          token.organizationRole = membership.role;
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
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
