// Applies pending SQL migrations from ./drizzle to the database pointed at by
// DATABASE_URL. Run with: npm run db:migrate
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  // eslint-disable-next-line no-console
  console.log("Migrations applied successfully.");
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Migration failed:", err);
  process.exit(1);
});
