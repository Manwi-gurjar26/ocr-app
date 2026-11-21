import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __ocrPool?: Pool };

export function createDb(url: string): { db: DB; pool: Pool } {
  const pool = new Pool({ connectionString: url, max: 10 });
  return { db: drizzle(pool, { schema }), pool };
}

// Reuse one pool across hot reloads in dev.
function defaultPool(): Pool {
  if (!globalForDb.__ocrPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.__ocrPool = new Pool({ connectionString: url, max: 10 });
  }
  return globalForDb.__ocrPool;
}

let _db: DB | undefined;
export function getDb(): DB {
  if (!_db) _db = drizzle(defaultPool(), { schema });
  return _db;
}
