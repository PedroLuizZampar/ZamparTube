import { beforeEach, describe, expect, it, vi } from "vitest";

const runSync = vi.fn();
vi.mock("@/lib/sync/run-sync", () => ({ runSync, createSyncDeps: () => ({}) }));

const { GET } = await import("@/app/api/cron/sync/route");

describe("GET /api/cron/sync", () => {
  beforeEach(() => {
    runSync.mockReset();
    vi.stubEnv("CRON_SECRET", "cron-secret");
  });

  it("401 without the bearer token and runSync is not called", async () => {
    const res = await GET(new Request("http://x/api/cron/sync"));
    expect(res.status).toBe(401);
    expect(runSync).not.toHaveBeenCalled();
  });

  it("401 with a wrong bearer token", async () => {
    const res = await GET(new Request("http://x/api/cron/sync", { headers: { authorization: "Bearer nope" } }));
    expect(res.status).toBe(401);
  });

  it("200 with the runSync result when authorized", async () => {
    runSync.mockResolvedValue({ synced: 2, remaining: 0, stoppedReason: "done" });
    const res = await GET(
      new Request("http://x/api/cron/sync", { headers: { authorization: "Bearer cron-secret" } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ synced: 2, remaining: 0, stoppedReason: "done" });
  });
});
