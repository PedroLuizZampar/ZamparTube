import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../helpers/db";
import { daysAgo, NOW } from "../../helpers/fake-youtube";
import { addToCategory, CH_A, CH_B, insertCategory, insertChannel, insertVideo, U, unfollow } from "../../helpers/fixtures";
import { channels, watchState } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { getVisibleVideo, listChannelVideos, listFeed, searchVideos } from "@/lib/queries/videos";
import { addToPlaylist, getWatchLaterId } from "@/lib/queries/playlists";
import { dismissFromFeed } from "@/lib/queries/watch";

const CH_C = "UCcccccccccccccccccccccc";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
  await insertChannel(db, CH_A);
  await insertChannel(db, CH_B);
});

const ids = (r: { items: { id: string }[] }) => r.items.map((v) => v.id);

describe("listFeed", () => {
  it("excludes shorts, pending checks, pending lives, watched, dismissed, removed channels and inFeed=false", async () => {
    await insertVideo(db, "ok");
    await insertVideo(db, "probed-ok", { durationSeconds: 120, shortsCheck: "ok" });
    await insertVideo(db, "rec", { liveState: "ended", isLiveRecording: true });
    await insertVideo(db, "short", { durationSeconds: 30, shortsCheck: "short", isShort: true });
    await insertVideo(db, "short-flag-only", { isShort: true });
    await insertVideo(db, "pending-check", { durationSeconds: 120, shortsCheck: "pending" });
    await insertVideo(db, "pending-live", { liveState: "pending" });
    await insertVideo(db, "watched");
    await db.insert(watchState).values({ userId: U, videoId: "watched", watched: true });
    await insertVideo(db, "dismissed");
    await dismissFromFeed(db, U, "dismissed");
    await insertVideo(db, "old", { inFeed: false });
    await insertVideo(db, "removed-ch", { channelId: CH_B });
    await unfollow(db, CH_B);

    expect(ids(await listFeed(db, U, { now: NOW, limit: 50 })).sort()).toEqual(["ok", "probed-ok"]);
  });

  it("filters by category and orders newest first", async () => {
    const cat = await insertCategory(db, "Programação");
    await addToCategory(db, CH_B, cat);
    await insertVideo(db, "a-old", { publishedAt: daysAgo(3) });
    await insertVideo(db, "b-new", { channelId: CH_B, publishedAt: daysAgo(1) });
    await insertVideo(db, "b-old", { channelId: CH_B, publishedAt: daysAgo(5) });

    expect(ids(await listFeed(db, U, { now: NOW, limit: 50 }))).toEqual(["b-new", "a-old", "b-old"]);
    expect(ids(await listFeed(db, U, { now: NOW, limit: 50, categoryIds: [cat] }))).toEqual(["b-new", "b-old"]);
  });

  it("filters by several categories", async () => {
    const cat1 = await insertCategory(db, "Um");
    const cat2 = await insertCategory(db, "Dois");
    await insertChannel(db, CH_C);
    await addToCategory(db, CH_A, cat1);
    await addToCategory(db, CH_B, cat2);
    await insertVideo(db, "a", { channelId: CH_A });
    await insertVideo(db, "b", { channelId: CH_B });
    await insertVideo(db, "c", { channelId: CH_C });

    expect(ids(await listFeed(db, U, { now: NOW, limit: 50, categoryIds: [cat1, cat2] })).sort()).toEqual(["a", "b"]);
    expect(ids(await listFeed(db, U, { now: NOW, limit: 50, categoryIds: [] })).sort()).toEqual(["a", "b", "c"]);
  });

  it("a channel in two categories shows up under either one", async () => {
    const cat1 = await insertCategory(db, "Um");
    const cat2 = await insertCategory(db, "Dois");
    await addToCategory(db, CH_A, cat1);
    await addToCategory(db, CH_A, cat2);
    await insertVideo(db, "a");
    await insertVideo(db, "b", { channelId: CH_B });
    expect(ids(await listFeed(db, U, { now: NOW, limit: 50, categoryIds: [cat1] }))).toEqual(["a"]);
    expect(ids(await listFeed(db, U, { now: NOW, limit: 50, categoryIds: [cat2] }))).toEqual(["a"]);
    expect(ids(await listFeed(db, U, { now: NOW, limit: 50, categoryIds: [cat1, cat2] }))).toEqual(["a"]);
  });

  it("filters by several channels and combines with categories", async () => {
    const cat1 = await insertCategory(db, "Um");
    await insertChannel(db, CH_C);
    await addToCategory(db, CH_A, cat1);
    await insertVideo(db, "a", { channelId: CH_A });
    await insertVideo(db, "b", { channelId: CH_B });
    await insertVideo(db, "c", { channelId: CH_C });

    expect(ids(await listFeed(db, U, { now: NOW, limit: 50, channelIds: [CH_A, CH_C] })).sort()).toEqual(["a", "c"]);
    expect(ids(await listFeed(db, U, { now: NOW, limit: 50, categoryIds: [cat1], channelIds: [CH_B] }))).toEqual([]);
  });

  it("only shows the last 14 days", async () => {
    await insertVideo(db, "d13", { publishedAt: daysAgo(13) });
    await insertVideo(db, "d15", { publishedAt: daysAgo(15) });
    expect(ids(await listFeed(db, U, { now: NOW, limit: 50 }))).toEqual(["d13"]);
  });

  it("marks cards saved for later", async () => {
    await insertVideo(db, "saved");
    await insertVideo(db, "plain", { publishedAt: daysAgo(2) });
    await addToPlaylist(db, U, await getWatchLaterId(db, U), "saved");
    const items = (await listFeed(db, U, { now: NOW, limit: 50 })).items;
    expect(items.map((v) => [v.id, v.savedForLater])).toEqual([
      ["saved", true],
      ["plain", false],
    ]);
  });

  it("returns hasMore when there are more than limit items", async () => {
    for (let i = 0; i < 5; i++) await insertVideo(db, `v${i}`, { publishedAt: daysAgo(i + 1) });
    const page = await listFeed(db, U, { now: NOW, limit: 3 });
    expect(ids(page)).toEqual(["v0", "v1", "v2"]);
    expect(page.hasMore).toBe(true);
    expect((await listFeed(db, U, { now: NOW, limit: 5 })).hasMore).toBe(false);
  });

  it("is empty when all caught up", async () => {
    expect(await listFeed(db, U, { now: NOW, limit: 24 })).toEqual({ items: [], hasMore: false });
  });

  it("maps card fields including channel and progress", async () => {
    await insertVideo(db, "v", { title: "Título", durationSeconds: 900 });
    await db.insert(watchState).values({ userId: U, videoId: "v", positionSeconds: 300 });
    const [card] = (await listFeed(db, U, { now: NOW, limit: 1 })).items;
    expect(card).toMatchObject({
      id: "v",
      title: "Título",
      channelId: CH_A,
      channelTitle: "Canal a",
      channelAvatarSrc: "",
      durationSeconds: 900,
      thumbnailUrl: "t-v.jpg",
      embeddable: true,
      isLiveRecording: false,
      positionSeconds: 300,
      watched: false,
    });
  });
});

describe("listChannelVideos", () => {
  it("includes watched and out-of-feed videos but never shorts or pending", async () => {
    await insertVideo(db, "w");
    await db.insert(watchState).values({ userId: U, videoId: "w", watched: true });
    await insertVideo(db, "old", { inFeed: false, publishedAt: daysAgo(400) });
    await insertVideo(db, "short", { isShort: true, shortsCheck: "short" });
    await insertVideo(db, "pend", { shortsCheck: "pending", durationSeconds: 100 });
    await insertVideo(db, "other", { channelId: CH_B });
    const r = await listChannelVideos(db, U, CH_A, { limit: 50 });
    expect(ids(r)).toEqual(["w", "old"]);
    expect(r.items[0].watched).toBe(true);
  });
});

describe("searchVideos", () => {
  it("finds by a description word and excludes shorts and removed channels", async () => {
    await insertVideo(db, "hit", { description: "Curso de programação em Rust" });
    await insertVideo(db, "short", { description: "programação rápida", isShort: true, shortsCheck: "short" });
    await insertVideo(db, "gone", { channelId: CH_B, description: "programação" });
    await unfollow(db, CH_B);
    await insertVideo(db, "miss", { description: "culinária" });
    expect(ids(await searchVideos(db, U, "programação", { limit: 10 }))).toEqual(["hit"]);
  });

  it("includes watched and out-of-feed videos", async () => {
    await insertVideo(db, "x", { title: "Arquitetura de software", inFeed: false });
    expect(ids(await searchVideos(db, U, "arquitetura", { limit: 10 }))).toEqual(["x"]);
  });

  it("empty query returns nothing", async () => {
    await insertVideo(db, "x");
    expect(await searchVideos(db, U, "   ", { limit: 10 })).toEqual({ items: [], hasMore: false });
  });
});

describe("live recordings", () => {
  it("hides live recordings from search, channel and watch page", async () => {
    await insertVideo(db, "rec", { liveState: "ended", isLiveRecording: true, title: "Live gravada" });
    expect(ids(await searchVideos(db, U, "gravada", { limit: 10 }))).toEqual([]);
    expect(ids(await listChannelVideos(db, U, CH_A, { limit: 10 }))).toEqual([]);
    expect(await getVisibleVideo(db, U, "rec")).toBeNull();
  });
});

describe("getVisibleVideo", () => {
  it("returns null for a short and for a pending live", async () => {
    await insertVideo(db, "s", { isShort: true, shortsCheck: "short" });
    await insertVideo(db, "l", { liveState: "pending" });
    expect(await getVisibleVideo(db, U, "s")).toBeNull();
    expect(await getVisibleVideo(db, U, "l")).toBeNull();
    expect(await getVisibleVideo(db, U, "missing")).toBeNull();
  });

  it("returns embeddable=false videos with description (UI shows the fallback)", async () => {
    await insertVideo(db, "e", { embeddable: false, description: "desc" });
    expect(await getVisibleVideo(db, U, "e")).toMatchObject({ id: "e", embeddable: false, description: "desc" });
  });

  it("still returns a video whose channel was removed (it may be in a playlist)", async () => {
    await insertVideo(db, "r", { channelId: CH_B });
    await unfollow(db, CH_B);
    expect(await getVisibleVideo(db, U, "r")).not.toBeNull();
  });
});

describe("channel avatar source", () => {
  it("points to the app's own /avatar route, versioned by fetch time, once the image is stored", async () => {
    await db
      .update(channels)
      .set({ avatarData: "AQID", avatarContentType: "image/jpeg", avatarFetchedAt: new Date("2026-11-01T00:00:00Z") })
      .where(eq(channels.id, CH_A));
    await insertVideo(db, "v");
    const [card] = (await listFeed(db, U, { now: NOW, limit: 1 })).items;
    expect(card.channelAvatarSrc).toBe(`/avatar/${CH_A}?v=1793491200`);
  });
});
