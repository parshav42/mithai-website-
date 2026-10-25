"use server";

import { signOut } from "@/auth";
import { getAdministratorSession } from "@/lib/admin/access";

export async function administratorSignOut() {
  if (!(await getAdministratorSession())) return;
  await signOut({ redirectTo: "/admin/login" });
}
