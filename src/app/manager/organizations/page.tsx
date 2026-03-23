import { redirect } from "next/navigation";

export default function ManagerOrganizationsPage() {
  redirect("/manager/settings?tab=org");
}
