// Creates/migrates the local PGlite database used when DATABASE_URL=pglite:<dir> (development only).
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const dir = process.argv[2] ?? "./.pglite";
const client = new PGlite(dir);
await migrate(drizzle(client), { migrationsFolder: "drizzle" });
await client.close();
console.log(`Banco local pronto em ${dir}`);
