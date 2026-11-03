import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Read .env.local / .env the same way Next.js does, so `npx drizzle-kit migrate` sees DATABASE_URL.
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL ?? "";
if (!url || url.startsWith("pglite:")) {
  throw new Error(
    "DATABASE_URL precisa ser a connection string do Neon (postgresql://...). " +
      "Para o banco local de desenvolvimento use `npm run db:dev`.",
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
