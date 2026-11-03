import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";

// Booting PGlite and running migrations takes seconds; do it once per test file and clone it per test.
let template: Promise<PGlite> | undefined;

function migratedTemplate(): Promise<PGlite> {
  template ??= (async () => {
    const client = new PGlite();
    await migrate(drizzle(client, { schema }), { migrationsFolder: "drizzle" });
    return client;
  })();
  return template;
}

/** Fresh in-memory Postgres with all migrations applied. */
export async function createTestDb(): Promise<Db> {
  const client = (await (await migratedTemplate()).clone()) as PGlite;
  return drizzle(client, { schema }) as unknown as Db;
}
