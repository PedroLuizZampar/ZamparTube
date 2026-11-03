import "server-only";
import { neon } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { getEnv } from "@/lib/env";

/** Works with both Neon (production) and PGlite (tests, local dev). No interactive transactions. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { __ztDb?: Db };

/**
 * Neon in production. For local development only, `DATABASE_URL=pglite:./.pglite`
 * uses an on-disk PGlite database (run `npm run db:dev` once to create it).
 */
export function getDb(): Db {
  if (!globalForDb.__ztDb) {
    const url = getEnv().DATABASE_URL;
    globalForDb.__ztDb = url.startsWith("pglite:")
      ? (drizzlePglite(new PGlite(url.slice("pglite:".length)), { schema }) as unknown as Db)
      : (drizzleNeon(neon(url), { schema }) as unknown as Db);
  }
  return globalForDb.__ztDb;
}
