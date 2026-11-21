import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "../src/db";

async function run(url: string | undefined, label: string) {
  if (!url) return console.log(`skip ${label}: no url`);
  const { db, pool } = createDb(url);
  await migrate(db, { migrationsFolder: "drizzle" });
  await pool.end();
  console.log(`migrated ${label}`);
}

await run(process.env.DATABASE_URL, "app db");
await run(process.env.TEST_DATABASE_URL, "test db");
