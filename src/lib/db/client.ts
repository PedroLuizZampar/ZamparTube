import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { getEnv } from "@/lib/env";

/** Works with both Neon (production) and PGlite (tests). No interactive transactions. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let instance: Db | undefined;

export function getDb(): Db {
  if (!instance) {
    instance = drizzle(neon(getEnv().DATABASE_URL), { schema }) as unknown as Db;
  }
  return instance;
}
