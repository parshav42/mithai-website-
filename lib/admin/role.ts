export function isAdministratorRole(role: string | undefined): role is "admin" {
  return role === "admin";
}
