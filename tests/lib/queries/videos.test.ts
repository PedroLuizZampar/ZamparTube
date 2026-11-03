import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../helpers/db";
import { daysAgo, NOW } from "../../helpers/fake-youtube";
import { CH_A, CH_B, insertCategory, insertChannel, insertVideo } from "../../helpers/fixtures";
import { channels, watchState } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { getVisibleVideo, listChannelVideos, listFeed, searchVideos } from "@/lib/queries/videos";

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
    await db.insert(watchState).values({ videoId: "watched", watched: true });
    await insertVideo(db, "dismissed", { dismissedAt: NOW });
    await insertVideo(db, "old", { inFeed: false });
    await insertVideo(db, "removed-ch", { channelId: CH_B });
    await db.update(channels).set({ removedAt: NOW }).where(eq(channels.id, CH_B));

    expect(ids(await listFeed(db, { limit: 50 })).sort()).toEqual(["ok", "probed-ok", "rec"]);
  });

  it("filters by category and orders newest first", async () => {
    const cat = await insertCategory(db, "Programação");
    await db.update(channels).set({ categoryId: cat }).where(eq(channels.id, CH_B));
    await insertVideo(db, "a-old", { publishedAt: daysAgo(3) });
    await insertVideo(db, "b-new", { channelId: CH_B, publishedAt: daysAgo(1) });
    await insertVideo(db, "b-old", { channelId: CH_B, publishedAt: daysAgo(5) });

    expect(ids(await listFeed(db, { limit: 50 }))).toEqual(["b-new", "a-old", "b-old"]);
    expect(ids(await listFeed(db, { limit: 50, categoryId: cat }))).toEqual(["b-new", "b-old"]);
  });

  it("returns hasMore when there are more than limit items", async () => {
    for (let i = 0; i < 5; i++) await insertVideo(db, `v${i}`, { publishedAt: daysAgo(i + 1) });
    const page = await listFeed(db, { limit: 3 });
    expect(ids(page)).toEqual(["v0", "v1", "v2"]);
    expect(page.hasMore).toBe(true);
    expect((await listFeed(db, { limit: 5 })).hasMore).toBe(false);
  });

  it("is empty when all caught up", async () => {
    expect(await listFeed(db, { limit: 24 })).toEqual({ items: [], hasMore: false });
  });

  it("maps card fields including channel and progress", async () => {
    await insertVideo(db, "v", { title: "Título", durationSeconds: 900 });
    await db.insert(watchState).values({ videoId: "v", positionSeconds: 300 });
    const [card] = (await listFeed(db, { limit: 1 })).items;
    expect(card).toMatchObject({
      id: "v",
      title: "Título",
      channelId: CH_A,
      channelTitle: "Canal a",
      channelAvatarUrl: "a.jpg",
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
    await db.insert(watchState).values({ videoId: "w", watched: true });
    await insertVideo(db, "old", { inFeed: false, publishedAt: daysAgo(400) });
    await insertVideo(db, "short", { isShort: true, shortsCheck: "short" });
    await insertVideo(db, "pend", { shortsCheck: "pending", durationSeconds: 100 });
    await insertVideo(db, "other", { channelId: CH_B });
    const r = await listChannelVideos(db, CH_A, { limit: 50 });
    expect(ids(r)).toEqual(["w", "old"]);
    expect(r.items[0].watched).toBe(true);
  });
});

describe("searchVideos", () => {
  it("finds by a description word and excludes shorts and removed channels", async () => {
    await insertVideo(db, "hit", { description: "Curso de programação em Rust" });
    await insertVideo(db, "short", { description: "programação rápida", isShort: true, shortsCheck: "short" });
    await insertVideo(db, "gone", { channelId: CH_B, description: "programação" });
    await db.update(channels).set({ removedAt: NOW }).where(eq(channels.id, CH_B));
    await insertVideo(db, "miss", { description: "culinária" });
    expect(ids(await searchVideos(db, "programação", { limit: 10 }))).toEqual(["hit"]);
  });

  it("includes watched and out-of-feed videos", async () => {
    await insertVideo(db, "x", { title: "Arquitetura de software", inFeed: false });
    expect(ids(await searchVideos(db, "arquitetura", { limit: 10 }))).toEqual(["x"]);
  });

  it("empty query returns nothing", async () => {
    await insertVideo(db, "x");
    expect(await searchVideos(db, "   ", { limit: 10 })).toEqual({ items: [], hasMore: false });
  });
});

describe("getVisibleVideo", () => {
  it("returns null for a short and for a pending live", async () => {
    await insertVideo(db, "s", { isShort: true, shortsCheck: "short" });
    await insertVideo(db, "l", { liveState: "pending" });
    expect(await getVisibleVideo(db, "s")).toBeNull();
    expect(await getVisibleVideo(db, "l")).toBeNull();
    expect(await getVisibleVideo(db, "missing")).toBeNull();
  });

  it("returns embeddable=false videos with description (UI shows the fallback)", async () => {
    await insertVideo(db, "e", { embeddable: false, description: "desc" });
    expect(await getVisibleVideo(db, "e")).toMatchObject({ id: "e", embeddable: false, description: "desc" });
  });

  it("still returns a video whose channel was removed (it may be in a playlist)", async () => {
    await insertVideo(db, "r", { channelId: CH_B });
    await db.update(channels).set({ removedAt: NOW }).where(eq(channels.id, CH_B));
    expect(await getVisibleVideo(db, "r")).not.toBeNull();
  });
});
