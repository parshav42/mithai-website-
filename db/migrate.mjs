import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const migrationVersion = "001_admin_orders";
const migrationPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
  `${migrationVersion}.sql`,
);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before running database migrations.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(29104731)");
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const existing = await client.query(
    "SELECT 1 FROM schema_migrations WHERE version = $1",
    [migrationVersion],
  );
  if (existing.rowCount === 0) {
    await client.query(await readFile(migrationPath, "utf8"));
    await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [
      migrationVersion,
    ]);
    console.log(`Applied database migration ${migrationVersion}.`);
  } else {
    console.log(`Database migration ${migrationVersion} is already applied.`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
