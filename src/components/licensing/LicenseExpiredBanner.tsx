import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureLicenseStatus } from "@/lib/keygen/license-sync";

export async function LicenseExpiredBanner() {
  const session = await getServerSession(authOptions);
  const organizationId = session?.user?.activeOrganizationId;
  if (!organizationId) return null;

  const { expired } = await ensureLicenseStatus(organizationId);
  if (!expired) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 border-b border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300"
    >
      <span className="font-semibold">License expired.</span>
      <span className="text-red-700/90 dark:text-red-300/90">
        Your organization&apos;s beta trial has ended. Creating projects,
        members, test cases, and test runs is disabled.
      </span>
      <a
        href="mailto:support@example.com?subject=License%20renewal"
        className="ml-auto underline underline-offset-2 hover:opacity-80"
      >
        Contact support
      </a>
    </div>
  );
}
