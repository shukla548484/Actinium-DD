import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy /admin/users route — employee management replaces this screen. */
export default function AdminUsersPage() {
  redirect("/admin/employees");
}
