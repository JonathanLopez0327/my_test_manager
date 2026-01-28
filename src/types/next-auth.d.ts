import type { DefaultSession } from "next-auth";
import type { GlobalRole } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      globalRoles: GlobalRole[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    globalRoles?: GlobalRole[];
  }
}
