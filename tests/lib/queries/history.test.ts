import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../helpers/db";
import { NOW } from "../../helpers/fake-youtube";
import { addToCategory, CH_A, CH_B, insertCategory, insertChannel, insertVideo, U, unfollow } from "../../helpers/fixtures";
import { watchState } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { listContinueWatching, listWatchedHistory } from "@/lib/queries/history";
import { dismissFromFeed } from "@/lib/queries/watch";

let db: Db;

const minutesAfter = (m: number) => new Date(NOW.getTime() + m * 60_000);
const ids = (r: { items: { id: string }[] }) => r.items.map((v) => v.id);

async function watch(videoId: string, positionSeconds: number, watched: boolean, at: Date) {
  await db.insert(watchState).values({ userId: U, videoId, positionSeconds, watched, updatedAt: at });
}

beforeEach(async () => {
  db = await createTestDb();
  await insertChannel(db, CH_A);
  await insertChannel(db, CH_B);
});

describe("listContinueWatching", () => {
  it("lists started, unfinished videos, most recent first", async () => {
    await insertVideo(db, "t1");
    await insertVideo(db, "t2");
    await insertVideo(db, "never");
    await insertVideo(db, "done");
    await watch("t1", 60, false, minutesAfter(1));
    await watch("t2", 30, false, minutesAfter(2));
    await watch("done", 590, true, minutesAfter(3));
    expect(ids(await listContinueWatching(db, U, { limit: 10 }))).toEqual(["t2", "t1"]);
  });

  it("includes dismissed and old videos (no feed window)", async () => {
    await insertVideo(db, "old", { publishedAt: new Date("2020-01-01T00:00:00Z"), inFeed: false });
    await dismissFromFeed(db, U, "old");
    await watch("old", 60, false, minutesAfter(1));
    expect(ids(await listContinueWatching(db, U, { limit: 10 }))).toEqual(["old"]);
  });
});

describe("listWatchedHistory", () => {
  it("lists watched videos, most recent first, and excludes unfinished", async () => {
    await insertVideo(db, "w1");
    await insertVideo(db, "w2");
    await insertVideo(db, "half");
    await watch("w1", 590, true, minutesAfter(1));
    await watch("w2", 0, true, minutesAfter(2));
    await watch("half", 100, false, minutesAfter(3));
    expect(ids(await listWatchedHistory(db, U, { limit: 10 }))).toEqual(["w2", "w1"]);
  });

  it("returns hasMore when there are more than limit items", async () => {
    await insertVideo(db, "w1");
    await insertVideo(db, "w2");
    await watch("w1", 590, true, minutesAfter(1));
    await watch("w2", 590, true, minutesAfter(2));
    const page = await listWatchedHistory(db, U, { limit: 1 });
    expect(ids(page)).toEqual(["w2"]);
    expect(page.hasMore).toBe(true);
  });
});

describe("history visibility", () => {
  it("hides live recordings and removed channels", async () => {
    await insertVideo(db, "rec", { liveState: "ended", isLiveRecording: true });
    await insertVideo(db, "gone", { channelId: CH_B });
    await insertVideo(db, "ok");
    await watch("rec", 60, false, minutesAfter(1));
    await watch("gone", 60, false, minutesAfter(2));
    await watch("ok", 60, false, minutesAfter(3));
    await unfollow(db, CH_B);
    expect(ids(await listContinueWatching(db, U, { limit: 10 }))).toEqual(["ok"]);
  });
});

describe("history filters", () => {
  it("filters both lists by category and channel", async () => {
    const cat = await insertCategory(db, "Um");
    await addToCategory(db, CH_B, cat);
    await insertVideo(db, "a-half");
    await insertVideo(db, "b-half", { channelId: CH_B });
    await insertVideo(db, "a-done");
    await insertVideo(db, "b-done", { channelId: CH_B });
    await watch("a-half", 60, false, minutesAfter(1));
    await watch("b-half", 60, false, minutesAfter(2));
    await watch("a-done", 590, true, minutesAfter(3));
    await watch("b-done", 590, true, minutesAfter(4));

    expect(ids(await listContinueWatching(db, U, { limit: 10, categoryIds: [cat] }))).toEqual(["b-half"]);
    expect(ids(await listWatchedHistory(db, U, { limit: 10, categoryIds: [cat] }))).toEqual(["b-done"]);
    expect(ids(await listContinueWatching(db, U, { limit: 10, channelIds: [CH_A] }))).toEqual(["a-half"]);
    expect(ids(await listWatchedHistory(db, U, { limit: 10, channelIds: [CH_A] }))).toEqual(["a-done"]);
  });
});
