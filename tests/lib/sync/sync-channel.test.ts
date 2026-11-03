import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../helpers/db";
import { createFakeYouTube, daysAgo, NOW, vid, type FakeYouTube } from "../../helpers/fake-youtube";
import { channels, playlistItems, playlists, videos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { syncChannel, type SyncDeps } from "@/lib/sync/sync-channel";
import type { ProbeResult } from "@/lib/youtube/shorts-probe";
import { getVisibleVideo, listChannelVideos, listFeed, searchVideos } from "@/lib/queries/videos";

const CH = "UCaaaaaaaaaaaaaaaaaaaaaa";
const LF = "UULFaaaaaaaaaaaaaaaaaaaaaa";
const LV = "UULVaaaaaaaaaaaaaaaaaaaaaa";
const UU = "UUaaaaaaaaaaaaaaaaaaaaaa";

let db: Db;

async function addChannel(extra: Partial<typeof channels.$inferInsert> = {}) {
  await db.insert(channels).values({ id: CH, title: "Canal", avatarUrl: "", uploadsPlaylistId: UU, ...extra });
}

function deps(yt: FakeYouTube, probe: (id: string) => Promise<ProbeResult> = async () => "not_short"): SyncDeps {
  return { db, yt, probe, now: NOW };
}

async function row(id: string) {
  const [r] = await db.select().from(videos).where(eq(videos.id, id));
  return r;
}

async function channelRow() {
  const [r] = await db.select().from(channels).where(eq(channels.id, CH));
  return r;
}

beforeEach(async () => {
  db = await createTestDb();
});

describe("syncChannel", () => {
  it("first import: videos older than 30 days get inFeed=false, newer true", async () => {
    await addChannel();
    const yt = createFakeYouTube({
      playlists: { [LF]: ["new", "old"], [LV]: [] },
      videos: { new: vid("new", { publishedAt: daysAgo(5) }), old: vid("old", { publishedAt: daysAgo(45) }) },
    });
    const r = await syncChannel(deps(yt), CH);
    expect(r.inserted).toBe(2);
    expect((await row("new")).inFeed).toBe(true);
    expect((await row("old")).inFeed).toBe(false);
    expect((await channelRow()).lastSyncedAt).toEqual(NOW);
  });

  it("incremental: stops paging at the first known id and new videos get inFeed=true", async () => {
    await addChannel({ lastSyncedAt: daysAgo(1) });
    const ids = Array.from({ length: 120 }, (_, i) => `v${i}`);
    const yt = createFakeYouTube({
      playlists: { [LF]: ["fresh", ...ids], [LV]: [] },
      videos: Object.fromEntries(
        ["fresh", ...ids].map((id) => [id, vid(id, { publishedAt: id === "fresh" ? daysAgo(0) : daysAgo(60) })]),
      ),
    });
    await db.insert(videos).values({
      id: "v0",
      channelId: CH,
      title: "known",
      publishedAt: daysAgo(60),
      durationSeconds: 600,
      thumbnailUrl: "",
      shortsCheck: "not_needed",
      liveState: "none",
      inFeed: false,
    });
    const r = await syncChannel(deps(yt), CH);
    const lfCalls = yt.calls.filter((c) => c.method === "listPlaylistPage" && c.playlistId === LF);
    expect(lfCalls).toHaveLength(1);
    expect(r.inserted).toBe(49); // fresh + v1..v48 on the first page minus known v0
    expect((await row("fresh")).inFeed).toBe(true);
  });

  it("UULF missing → uses UU, flags the channel, and a 60s video stays pending until the probe says not_short", async () => {
    await addChannel();
    const yt = createFakeYouTube({
      missingPlaylists: [LF],
      playlists: { [UU]: ["short1", "long1"], [LV]: [] },
      videos: { short1: vid("short1", { durationSeconds: 60 }), long1: vid("long1") },
    });
    let answer: ProbeResult = "unknown";
    await syncChannel(deps(yt, async () => answer), CH);
    expect((await channelRow()).longPlaylistMissing).toBe(true);
    expect(await row("long1")).toMatchObject({ shortsCheck: "not_needed", isShort: false });
    expect(await row("short1")).toMatchObject({ shortsCheck: "pending", shortsCheckFailures: 1 });

    answer = "not_short";
    await syncChannel(deps(yt, async () => answer), CH);
    expect(await row("short1")).toMatchObject({ shortsCheck: "ok", isShort: false });
    const ufCalls = yt.calls.filter((c) => c.method === "listPlaylistPage" && c.playlistId === LF);
    expect(ufCalls).toHaveLength(1); // second sync goes straight to UU
  });

  it("probe 'short' → isShort true and shortsCheck short", async () => {
    await addChannel();
    const yt = createFakeYouTube({
      playlists: { [LF]: ["s"], [LV]: [] },
      videos: { s: vid("s", { durationSeconds: 45 }) },
    });
    await syncChannel(deps(yt, async () => "short"), CH);
    expect(await row("s")).toMatchObject({ isShort: true, shortsCheck: "short" });
  });

  it("UULV missing → no error, long videos still synced", async () => {
    await addChannel();
    const yt = createFakeYouTube({ missingPlaylists: [LV], playlists: { [LF]: ["a"] }, videos: { a: vid("a") } });
    const r = await syncChannel(deps(yt), CH);
    expect(r.inserted).toBe(1);
  });

  it("UULV generic error → ignored, long videos still synced", async () => {
    await addChannel();
    const yt = createFakeYouTube({
      failingPlaylists: [LV],
      playlists: { [LF]: ["a"], [LV]: [] },
      videos: { a: vid("a") },
    });
    const r = await syncChannel(deps(yt), CH);
    expect(r.inserted).toBe(1);
  });

  it("imports ended live recordings and keeps upcoming lives pending", async () => {
    await addChannel();
    const yt = createFakeYouTube({
      playlists: { [LF]: [], [LV]: ["rec", "up"] },
      videos: {
        rec: vid("rec", { durationSeconds: 5400, liveActualEndTime: daysAgo(2) }),
        up: vid("up", { durationSeconds: 0, liveBroadcastContent: "upcoming" }),
      },
    });
    await syncChannel(deps(yt), CH);
    expect(await row("rec")).toMatchObject({ liveState: "ended", isLiveRecording: true, inFeed: true });
    expect(await row("up")).toMatchObject({ liveState: "pending" });
  });

  it("a pending live becomes ended on a later sync and stays in the feed", async () => {
    await addChannel({ lastSyncedAt: daysAgo(1) });
    const yt = createFakeYouTube({
      playlists: { [LF]: [], [LV]: ["l"] },
      videos: { l: vid("l", { durationSeconds: 0, liveBroadcastContent: "live" }) },
    });
    await syncChannel(deps(yt), CH);
    expect(await row("l")).toMatchObject({ liveState: "pending", inFeed: true });

    yt.videos.l = vid("l", { durationSeconds: 7200, liveActualEndTime: NOW });
    await syncChannel(deps(yt), CH);
    expect(await row("l")).toMatchObject({
      liveState: "ended",
      isLiveRecording: true,
      durationSeconds: 7200,
      shortsCheck: "not_needed",
      inFeed: true,
    });
  });

  it("a pending video missing from videos.list is deleted and removed from playlists", async () => {
    await addChannel({ lastSyncedAt: daysAgo(1) });
    const yt = createFakeYouTube({
      playlists: { [LF]: [], [LV]: ["gone"] },
      videos: { gone: vid("gone", { liveBroadcastContent: "upcoming", durationSeconds: 0 }) },
    });
    await syncChannel(deps(yt), CH);
    const [wl] = await db.select().from(playlists);
    await db.insert(playlistItems).values({ playlistId: wl.id, videoId: "gone", position: 0 });

    delete yt.videos.gone;
    const r = await syncChannel(deps(yt), CH);
    expect(r.removed).toBe(1);
    expect(await row("gone")).toBeUndefined();
    expect(await db.select().from(playlistItems)).toHaveLength(0);
  });

  it("first import of a 2500-video channel backfills over several runs", async () => {
    await addChannel();
    const ids = Array.from({ length: 2500 }, (_, i) => `b${i}`);
    const yt = createFakeYouTube({
      playlists: { [LF]: ids, [LV]: [] },
      videos: Object.fromEntries(ids.map((id, i) => [id, vid(id, { publishedAt: daysAgo(i < 10 ? 1 : 100) })])),
    });

    const r1 = await syncChannel(deps(yt), CH);
    expect(r1).toMatchObject({ inserted: 1000, backfillDone: false });
    expect((await channelRow()).backfillPageToken).not.toBeNull();

    const r2 = await syncChannel(deps(yt), CH);
    expect(r2).toMatchObject({ inserted: 1000, backfillDone: false });

    const r3 = await syncChannel(deps(yt), CH);
    expect(r3).toMatchObject({ inserted: 500, backfillDone: true });
    expect((await channelRow()).backfillPageToken).toBeNull();

    expect((await row("b5")).inFeed).toBe(true);
    expect((await row("b2400")).inFeed).toBe(false);
    expect((await row("b1500")).inFeed).toBe(false);
  });

  it("throws for a removed channel", async () => {
    await addChannel({ removedAt: daysAgo(1) });
    await expect(syncChannel(deps(createFakeYouTube()), CH)).rejects.toThrow();
  });

  it("a short (or an unverified short-length video) never appears in listFeed, searchVideos or listChannelVideos", async () => {
    await addChannel();
    const yt = createFakeYouTube({
      missingPlaylists: [LF], // fallback: UU includes Shorts
      playlists: { [UU]: ["short", "unverified", "long"], [LV]: [] },
      videos: {
        short: vid("short", { durationSeconds: 40, title: "programação curta" }),
        unverified: vid("unverified", { durationSeconds: 90, title: "programação talvez" }),
        long: vid("long", { title: "programação longa" }),
      },
    });
    await syncChannel(deps(yt, async (id) => (id === "short" ? "short" : "unknown")), CH);

    const seen = [
      ...(await listFeed(db, { limit: 50 })).items,
      ...(await searchVideos(db, "programação", { limit: 50 })).items,
      ...(await listChannelVideos(db, CH, { limit: 50 })).items,
    ].map((v) => v.id);
    expect(new Set(seen)).toEqual(new Set(["long"]));
    expect(await getVisibleVideo(db, "short")).toBeNull();
    expect(await getVisibleVideo(db, "unverified")).toBeNull();
  });
});

describe("syncChannel — review 1 fixes", () => {
  it("a regular in-feed video deleted on YouTube is removed from the DB and playlists", async () => {
    await addChannel();
    const yt = createFakeYouTube({
      playlists: { [LF]: ["keep", "gone"], [LV]: [] },
      videos: { keep: vid("keep"), gone: vid("gone") },
    });
    await syncChannel(deps(yt), CH);
    const [wl] = await db.select().from(playlists);
    await db.insert(playlistItems).values({ playlistId: wl.id, videoId: "gone", position: 0 });

    delete yt.videos.gone;
    const r = await syncChannel(deps(yt), CH);
    expect(r.removed).toBe(1);
    expect(await row("gone")).toBeUndefined();
    expect(await row("keep")).toBeDefined();
    expect(await db.select().from(playlistItems)).toHaveLength(0);
  });

  it("UULF disappearing during backfill clears the stale token and keeps syncing via UU", async () => {
    await addChannel();
    const ids = Array.from({ length: 1100 }, (_, i) => `b${i}`);
    const yt = createFakeYouTube({
      playlists: { [LF]: ids, [LV]: [], [UU]: ["brand-new", ...ids] },
      videos: Object.fromEntries(["brand-new", ...ids].map((id) => [id, vid(id)])),
    });
    await syncChannel(deps(yt), CH);
    expect((await channelRow()).backfillPageToken).not.toBeNull();

    yt.missingPlaylists.push(LF);
    // The real API rejects a UULF page token on the UU playlist.
    const original = yt.listPlaylistPage.bind(yt);
    yt.listPlaylistPage = async (id, token) => {
      if (id === UU && token) {
        const { YouTubeApiError } = await import("@/lib/youtube/client");
        throw new YouTubeApiError(400, "invalidPageToken", "bad token");
      }
      return original(id, token);
    };
    await syncChannel(deps(yt), CH);
    expect(await row("brand-new")).toBeDefined();
    expect((await channelRow()).longPlaylistMissing).toBe(true);
    expect((await channelRow()).backfillPageToken).toBeNull();
  });

  it("an invalid backfill token is dropped instead of failing the channel forever", async () => {
    await addChannel({ lastSyncedAt: daysAgo(1), backfillPageToken: "999999" });
    const yt = createFakeYouTube({ playlists: { [LF]: ["n"], [LV]: [] }, videos: { n: vid("n") } });
    const original = yt.listPlaylistPage.bind(yt);
    yt.listPlaylistPage = async (id, token) => {
      if (token === "999999") {
        const { YouTubeApiError } = await import("@/lib/youtube/client");
        throw new YouTubeApiError(400, "invalidPageToken", "bad token");
      }
      return original(id, token);
    };
    const r = await syncChannel(deps(yt), CH);
    expect(r.inserted).toBe(1);
    expect((await channelRow()).backfillPageToken).toBeNull();
  });

  it("an ended live still reporting 0s duration stays pending until YouTube reports the real length", async () => {
    await addChannel({ lastSyncedAt: daysAgo(1) });
    const yt = createFakeYouTube({
      playlists: { [LF]: [], [LV]: ["l"] },
      videos: { l: vid("l", { durationSeconds: 0, liveActualEndTime: NOW }) },
    });
    await syncChannel(deps(yt), CH);
    expect(await row("l")).toMatchObject({ liveState: "pending" });

    yt.videos.l = vid("l", { durationSeconds: 3600, liveActualEndTime: NOW });
    await syncChannel(deps(yt), CH);
    expect(await row("l")).toMatchObject({ liveState: "ended", durationSeconds: 3600 });
  });
});

describe("syncChannel — final review fixes", () => {
  it("a re-added channel does not flood the feed with videos older than 30 days", async () => {
    await addChannel({ lastSyncedAt: daysAgo(200) });
    await db.insert(videos).values({
      id: "known",
      channelId: CH,
      title: "known",
      publishedAt: daysAgo(200),
      durationSeconds: 600,
      thumbnailUrl: "",
      shortsCheck: "not_needed",
      liveState: "none",
      inFeed: false,
    });
    const yt = createFakeYouTube({
      playlists: { [LF]: ["new", "old", "known"], [LV]: [] },
      videos: { new: vid("new", { publishedAt: daysAgo(2) }), old: vid("old", { publishedAt: daysAgo(90) }) },
    });
    await syncChannel(deps(yt), CH);
    expect((await row("new")).inFeed).toBe(true);
    expect((await row("old")).inFeed).toBe(false);
  });

  it("old live recordings found after a failed first-import UULV read stay out of the feed", async () => {
    await addChannel();
    const yt = createFakeYouTube({
      failingPlaylists: [LV],
      playlists: { [LF]: ["a"], [LV]: ["rec-old"] },
      videos: {
        a: vid("a"),
        "rec-old": vid("rec-old", { durationSeconds: 5400, liveActualEndTime: daysAgo(300), publishedAt: daysAgo(300) }),
      },
    });
    await syncChannel(deps(yt), CH);
    const healthy = createFakeYouTube({ playlists: yt.playlists, videos: yt.videos });
    await syncChannel(deps(healthy), CH);
    expect(await row("rec-old")).toMatchObject({ liveState: "ended", inFeed: false });
  });
});

describe("syncChannel — channel avatar", () => {
  const img = { base64: "AQID", contentType: "image/jpeg" };
  const emptyYt = () => createFakeYouTube({ playlists: { [LF]: [], [LV]: [] } });

  it("downloads and stores the avatar when missing", async () => {
    await addChannel({ avatarUrl: "https://yt3.ggpht.com/a" });
    const asked: string[] = [];
    await syncChannel({ ...deps(emptyYt()), fetchImage: async (u) => (asked.push(u), img) }, CH);
    expect(asked).toEqual(["https://yt3.ggpht.com/a"]);
    expect(await channelRow()).toMatchObject({ avatarData: "AQID", avatarContentType: "image/jpeg", avatarFetchedAt: NOW });
  });

  it("does not download again within 7 days", async () => {
    await addChannel({ avatarUrl: "u", avatarData: "AQID", avatarContentType: "image/jpeg", avatarFetchedAt: daysAgo(3) });
    let calls = 0;
    await syncChannel({ ...deps(emptyYt()), fetchImage: async () => (calls++, img) }, CH);
    expect(calls).toBe(0);
  });

  it("keeps going without an avatar when the download fails", async () => {
    await addChannel({ avatarUrl: "u" });
    const r = await syncChannel({ ...deps(emptyYt()), fetchImage: async () => null }, CH);
    expect(r.channelId).toBe(CH);
    expect((await channelRow()).avatarData).toBeNull();
  });
});
