import { usePostgres } from "./schema";
import * as schema from "./schema";
import * as pgSchema from "./schema.pg";
import * as sqliteSchema from "./schema.sqlite";

// Export the Drizzle ORM db instance — conditionally uses PostgreSQL (Neon)
// when DATABASE_URL is set, otherwise falls back to local SQLite.
let _db: any;

if (usePostgres) {
  // PostgreSQL via node-postgres (Neon compatible)
  const { Pool } = require("pg");
  const { drizzle } = require("drizzle-orm/node-postgres");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Neon uses pooled connections; keep max low for serverless
    max: 5,
    idleTimeoutMillis: 30000,
  });

  _db = drizzle(pool, { schema: pgSchema });
  console.log("[db] Connected to PostgreSQL (Neon)");
} else {
  // SQLite via Bun (local dev)
  const { Database } = require("bun:sqlite");
  const { drizzle } = require("drizzle-orm/bun-sqlite");

  const sqlite = new Database("pipelineforge.db");
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA foreign_keys = ON");

  _db = drizzle(sqlite, { schema: sqliteSchema });
  console.log("[db] Connected to SQLite (local)");
}

export const db = _db;

// Re-export schema for convenience
export { schema, pgSchema, sqliteSchema };
