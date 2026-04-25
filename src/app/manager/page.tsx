import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function ManagerPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.activeOrganizationId) {
    redirect("/manager/settings");
  }

  redirect("/manager/projects");
}
