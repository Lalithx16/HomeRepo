// Runs supabase/tests/*.test.sql against a Postgres database that already has
// the Homebase migrations applied (e.g. local Supabase after `npx supabase db reset`).
// Each test file wraps itself in BEGIN/ROLLBACK, so no data is left behind.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set. See .env.example (local default: postgresql://postgres:postgres@127.0.0.1:54322/postgres).");
  process.exit(1);
}

const dir = path.resolve("supabase/tests");
const files = readdirSync(dir).filter((f) => f.endsWith(".test.sql")).sort();
const client = new pg.Client({ connectionString: url });
await client.connect();
let failed = 0;
for (const file of files) {
  const sql = readFileSync(path.join(dir, file), "utf8");
  try {
    await client.query(sql);
    console.log(`PASS ${file}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${file}\n  ${error.message}${error.detail ? `\n  ${error.detail}` : ""}`);
    await client.query("rollback").catch(() => {});
  }
}
await client.end();
process.exit(failed ? 1 : 0);
