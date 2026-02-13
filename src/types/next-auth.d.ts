import type { DefaultSession } from "next-auth";
import type { GlobalRole, OrgRole } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      globalRoles: GlobalRole[];
      activeOrganizationId?: string;
      organizationRole?: OrgRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    globalRoles?: GlobalRole[];
    activeOrganizationId?: string;
    organizationRole?: OrgRole;
  }
}
