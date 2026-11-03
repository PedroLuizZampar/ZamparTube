import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../helpers/db";
import { createFakeYouTube, daysAgo, NOW, vid } from "../../helpers/fake-youtube";
import { channels } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { runSync } from "@/lib/sync/run-sync";

let db: Db;
const ids = ["UCaaaaaaaaaaaaaaaaaaaaaa", "UCbbbbbbbbbbbbbbbbbbbbbb", "UCcccccccccccccccccccccc"];
const lf = (id: string) => id.replace(/^UC/, "UULF");
const lv = (id: string) => id.replace(/^UC/, "UULV");

function fakeFor(extra: Parameters<typeof createFakeYouTube>[0] = {}) {
  return createFakeYouTube({
    playlists: Object.fromEntries(ids.flatMap((id) => [[lf(id), [`${id}-v`]], [lv(id), []]])),
    videos: Object.fromEntries(ids.map((id) => [`${id}-v`, vid(`${id}-v`, { channelId: id })])),
    ...extra,
  });
}

beforeEach(async () => {
  db = await createTestDb();
  // c was synced most recently, a never: order must be a, b, c.
  await db.insert(channels).values([
    { id: ids[2], title: "C", avatarUrl: "", uploadsPlaylistId: "x", lastSyncedAt: daysAgo(1) },
    { id: ids[1], title: "B", avatarUrl: "", uploadsPlaylistId: "x", lastSyncedAt: daysAgo(3) },
    { id: ids[0], title: "A", avatarUrl: "", uploadsPlaylistId: "x" },
  ]);
});

afterEach(() => vi.restoreAllMocks());

async function lastSynced(id: string) {
  const [r] = await db.select().from(channels).where(eq(channels.id, id));
  return r.lastSyncedAt;
}

describe("runSync", () => {
  it("syncs every active channel, least recently synced first", async () => {
    const yt = fakeFor();
    const r = await runSync({ db, yt, probe: async () => "not_short", now: NOW });
    expect(r).toEqual({ synced: 3, remaining: 0, stoppedReason: "done" });
    const order = yt.calls.filter((c) => c.method === "listPlaylistPage").map((c) => c.playlistId.slice(4, 5));
    expect([...new Set(order)]).toEqual(["a", "b", "c"]);
  });

  it("skips removed channels", async () => {
    await db.update(channels).set({ removedAt: NOW }).where(eq(channels.id, ids[1]));
    const r = await runSync({ db, yt: fakeFor(), probe: async () => "not_short", now: NOW });
    expect(r.synced).toBe(2);
  });

  it("stops with 'budget' and reports remaining when the budget is exhausted", async () => {
    let t = 0;
    const r = await runSync(
      { db, yt: fakeFor(), probe: async () => "not_short", now: NOW },
      { budgetMs: 45_000, nowMs: () => (t += 30_000) },
    );
    expect(r.stoppedReason).toBe("budget");
    expect(r.synced).toBeGreaterThanOrEqual(1);
    expect(r.synced + r.remaining).toBe(3);
  });

  it("stops with 'quota' and leaves the failing channel's lastSyncedAt untouched", async () => {
    // Channel a needs 3 calls (UULF, UULV, videos); the 4th call (b's UULF) hits the quota.
    const r = await runSync({ db, yt: fakeFor({ quotaAfterCalls: 3 }), probe: async () => "not_short", now: NOW });
    expect(r).toEqual({ synced: 1, remaining: 2, stoppedReason: "quota" });
    expect(await lastSynced(ids[0])).toEqual(NOW);
    expect(await lastSynced(ids[1])).toEqual(daysAgo(3));
  });

  it("an error in one channel does not stop the others", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await runSync({
      db,
      yt: fakeFor({ failingPlaylists: [lf(ids[0])] }),
      probe: async () => "not_short",
      now: NOW,
    });
    expect(r).toEqual({ synced: 2, remaining: 0, stoppedReason: "done" });
    expect(await lastSynced(ids[0])).toBeNull();
    expect(await lastSynced(ids[2])).toEqual(NOW);
  });
});
