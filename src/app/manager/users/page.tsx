import { redirect } from "next/navigation";

export default function ManagerUsersPage() {
  redirect("/manager/settings?tab=users");
}
