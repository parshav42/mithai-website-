import { auth } from "../../auth.ts";

export async function getAdministratorSession() {
  const session = await auth();
  return session?.user?.role === "admin" ? session : null;
}
