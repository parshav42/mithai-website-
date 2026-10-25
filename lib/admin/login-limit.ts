import "server-only";
import { createHash } from "node:crypto";
import { getDatabasePool } from "../db.ts";

const MAX_ATTEMPTS = 8;
const WINDOW_MINUTES = 15;

function administratorKey(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export async function reserveAdministratorLoginAttempt(email: string) {
  const result = await getDatabasePool().query<{
    attempts: number;
    locked_until: Date | null;
  }>(
    `INSERT INTO admin_login_limits (identifier_hash, attempts, window_started_at)
     VALUES ($1, 1, NOW())
     ON CONFLICT (identifier_hash) DO UPDATE SET
       attempts = CASE
         WHEN admin_login_limits.window_started_at < NOW() - ($2 * INTERVAL '1 minute') THEN 1
         ELSE admin_login_limits.attempts + 1
       END,
       window_started_at = CASE
         WHEN admin_login_limits.window_started_at < NOW() - ($2 * INTERVAL '1 minute') THEN NOW()
         ELSE admin_login_limits.window_started_at
       END,
       locked_until = CASE
         WHEN admin_login_limits.window_started_at < NOW() - ($2 * INTERVAL '1 minute') THEN NULL
         WHEN admin_login_limits.attempts + 1 >= $3
           THEN NOW() + ($2 * INTERVAL '1 minute')
         ELSE admin_login_limits.locked_until
       END
     RETURNING attempts, locked_until`,
    [administratorKey(email), WINDOW_MINUTES, MAX_ATTEMPTS],
  );
  const row = result.rows[0];
  return Boolean(row && row.attempts <= MAX_ATTEMPTS && (!row.locked_until || row.locked_until <= new Date()));
}

export async function clearAdministratorLoginAttempts(email: string) {
  await getDatabasePool().query(
    "DELETE FROM admin_login_limits WHERE identifier_hash = $1",
    [administratorKey(email)],
  );
}
