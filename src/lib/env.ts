import { z } from "zod";

const ENV_KEYS = ["YOUTUBE_API_KEY", "DATABASE_URL", "APP_PASSWORD", "SESSION_SECRET", "CRON_SECRET"] as const;

const envSchema = z.object(
  Object.fromEntries(ENV_KEYS.map((k) => [k, z.string().min(1)])) as Record<(typeof ENV_KEYS)[number], z.ZodString>,
);

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  const raw = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k] ?? ""]));
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const missing = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    throw new Error(`Variáveis de ambiente faltando: ${missing.join(", ")}`);
  }
  return result.data;
}
