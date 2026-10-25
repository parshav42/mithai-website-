import { auth } from "../../auth.ts";
import { isAdministratorConfigured } from "./password.ts";
import { isAdministratorRole } from "./role.ts";

export async function getAdministratorSession() {
  if (!isAdministratorConfigured()) return null;
  const session = await auth();
  return isAdministratorRole(session?.user?.role) ? session : null;
}
