import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const { Pool } = pg;
const migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "migrations");
const migrationVersions = [
  "001_admin_orders",
  "002_order_notifications",
  "003_product_management",
];

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL_UNPOOLED or DATABASE_URL must be set before running database migrations.",
  );
}

const pool = new Pool({ connectionString, max: 1 });
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
  for (const migrationVersion of migrationVersions) {
    const existing = await client.query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      [migrationVersion],
    );
    if (existing.rowCount === 0) {
      await client.query(await readFile(resolve(migrationDirectory, `${migrationVersion}.sql`), "utf8"));
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [migrationVersion]);
      console.log(`Applied database migration ${migrationVersion}.`);
    } else {
      console.log(`Database migration ${migrationVersion} is already applied.`);
    }
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
