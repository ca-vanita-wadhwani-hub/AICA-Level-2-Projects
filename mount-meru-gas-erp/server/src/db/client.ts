import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // eslint-disable-next-line no-console
  console.warn(
    "[db] DATABASE_URL is not set. The API will fail on first query. " +
      "Set DATABASE_URL in your .env file (see .env.example).",
  );
}

export const pool = new pg.Pool({
  connectionString: connectionString || "postgres://user:pass@localhost:5432/mount_meru_gas",
});

export const db = drizzle(pool, { schema });
