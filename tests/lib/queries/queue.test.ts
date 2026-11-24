import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../helpers/db";
import { CH_A, insertChannel, insertVideo } from "../../helpers/fixtures";
import { videos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import {
  clearQueue,
  enqueue,
  listQueue,
  markPlaying,
  moveInQueue,
  queueCount,
  queueCursor,
  queueNeighbors,
  queueResumeId,
  removeFromQueue,
  replaceQueue,
} from "@/lib/queries/queue";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
  await insertChannel(db, CH_A);
  for (const id of ["a", "b", "c", "d", "e"]) await insertVideo(db, id);
});

const ids = async () => (await listQueue(db)).map((v) => v.id);

describe("queue", () => {
  it("enqueue end keeps order", async () => {
    await enqueue(db, ["a", "b"], "end");
    await enqueue(db, ["c"], "end");
    expect(await ids()).toEqual(["a", "b", "c"]);
  });

  it("enqueue next goes to the front when nothing was played", async () => {
    await enqueue(db, ["a", "b"], "end");
    await enqueue(db, ["c", "d"], "next");
    expect(await ids()).toEqual(["c", "d", "a", "b"]);
  });

  it("enqueue next goes right after the video last played", async () => {
    await enqueue(db, ["a", "b", "c"], "end");
    await markPlaying(db, "b");
    await enqueue(db, ["d", "e"], "next");
    expect(await ids()).toEqual(["a", "b", "d", "e", "c"]);
  });

  it("enqueue an existing id moves it, never duplicates", async () => {
    await enqueue(db, ["a", "b", "c"], "end");
    await enqueue(db, ["a"], "end");
    expect(await ids()).toEqual(["b", "c", "a"]);
    await enqueue(db, ["c"], "next");
    expect(await ids()).toEqual(["c", "b", "a"]);
    await enqueue(db, ["c"], "next");
    expect(await ids()).toEqual(["c", "b", "a"]);
  });

  it("playing a video keeps it in the queue and makes it the cursor", async () => {
    await enqueue(db, ["a", "b", "c"], "end");
    await markPlaying(db, "b");
    expect(await ids()).toEqual(["a", "b", "c"]);
    expect(await queueCount(db)).toBe(3);
    expect(await queueCursor(db)).toBe("b");
    await markPlaying(db, "a");
    expect(await queueCursor(db)).toBe("a");
  });

  it("markPlaying of a video not in the queue is a no-op", async () => {
    await enqueue(db, ["a"], "end");
    await markPlaying(db, "e");
    expect(await ids()).toEqual(["a"]);
    expect(await queueCursor(db)).toBeNull();
  });

  it("neighbours follow the queue order for a queued video", async () => {
    await enqueue(db, ["a", "b", "c"], "end");
    expect(await queueNeighbors(db, "a")).toEqual({ prev: null, next: "b" });
    expect(await queueNeighbors(db, "b")).toEqual({ prev: "a", next: "c" });
    expect(await queueNeighbors(db, "c")).toEqual({ prev: "b", next: null });
  });

  it("a video outside the queue leads back to where the queue stopped", async () => {
    await enqueue(db, ["a", "b", "c"], "end");
    expect(await queueNeighbors(db, "e")).toEqual({ prev: null, next: "a" });
    await markPlaying(db, "b");
    expect(await queueNeighbors(db, "e")).toEqual({ prev: null, next: "b" });
  });

  it("resume id is the last played video, or the first one", async () => {
    expect(await queueResumeId(db)).toBeNull();
    await enqueue(db, ["a", "b", "c"], "end");
    expect(await queueResumeId(db)).toBe("a");
    await markPlaying(db, "c");
    expect(await queueResumeId(db)).toBe("c");
    await removeFromQueue(db, "c");
    expect(await queueResumeId(db)).toBe("a");
  });

  it("neighbours and listing skip invisible videos", async () => {
    await enqueue(db, ["a", "b", "c"], "end");
    await db.update(videos).set({ isLiveRecording: true }).where(eq(videos.id, "b"));
    expect(await ids()).toEqual(["a", "c"]);
    expect(await queueNeighbors(db, "a")).toEqual({ prev: null, next: "c" });
    expect(await queueCount(db)).toBe(2);
  });

  it("clear, replace, move, remove and count", async () => {
    await enqueue(db, ["a", "b", "c"], "end");
    await markPlaying(db, "a");
    await moveInQueue(db, "c", 0);
    expect(await ids()).toEqual(["c", "a", "b"]);
    await moveInQueue(db, "c", 2);
    expect(await ids()).toEqual(["a", "b", "c"]);
    expect(await queueCursor(db)).toBe("a");
    await removeFromQueue(db, "b");
    expect(await ids()).toEqual(["a", "c"]);
    expect(await queueCount(db)).toBe(2);
    await replaceQueue(db, ["d", "e"]);
    expect(await ids()).toEqual(["d", "e"]);
    expect(await queueCursor(db)).toBeNull();
    await clearQueue(db);
    expect(await ids()).toEqual([]);
    expect(await queueCount(db)).toBe(0);
  });
});
