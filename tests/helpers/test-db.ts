import { sql } from "drizzle-orm";
import { createDb } from "@/db";

export function testDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  const { db, pool } = createDb(url);
  return {
    db,
    reset: () => db.execute(sql`truncate table documents cascade`),
    close: () => pool.end(),
  };
}
