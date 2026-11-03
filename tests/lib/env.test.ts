import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnv } from "@/lib/env";

function stubAll() {
  vi.stubEnv("YOUTUBE_API_KEY", "k");
  vi.stubEnv("DATABASE_URL", "postgres://x");
  vi.stubEnv("APP_PASSWORD", "p");
  vi.stubEnv("SESSION_SECRET", "s");
  vi.stubEnv("CRON_SECRET", "c");
}

describe("getEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns all vars when present", () => {
    stubAll();
    const env = getEnv();
    expect(env.CRON_SECRET).toBe("c");
    expect(env.YOUTUBE_API_KEY).toBe("k");
  });

  it("throws listing every missing var", () => {
    stubAll();
    vi.stubEnv("YOUTUBE_API_KEY", "");
    vi.stubEnv("APP_PASSWORD", "");
    expect(() => getEnv()).toThrow(/YOUTUBE_API_KEY.*APP_PASSWORD|APP_PASSWORD.*YOUTUBE_API_KEY/);
  });
});
