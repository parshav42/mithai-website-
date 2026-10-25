import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdministratorSession } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getAdministratorSession();
  if (!session) redirect("/admin/login");
  return (
    <AdminShell administrator={session.user.email ?? "Shop administrator"}>
      {children}
    </AdminShell>
  );
}
