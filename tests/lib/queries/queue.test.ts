import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../helpers/db";
import { CH_A, insertChannel, insertVideo, U } from "../../helpers/fixtures";
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

const ids = async () => (await listQueue(db, U)).map((v) => v.id);

describe("queue", () => {
  it("enqueue end keeps order", async () => {
    await enqueue(db, U, ["a", "b"], "end");
    await enqueue(db, U, ["c"], "end");
    expect(await ids()).toEqual(["a", "b", "c"]);
  });

  it("enqueue next goes to the front when nothing was played", async () => {
    await enqueue(db, U, ["a", "b"], "end");
    await enqueue(db, U, ["c", "d"], "next");
    expect(await ids()).toEqual(["c", "d", "a", "b"]);
  });

  it("enqueue next goes right after the video last played", async () => {
    await enqueue(db, U, ["a", "b", "c"], "end");
    await markPlaying(db, U, "b");
    await enqueue(db, U, ["d", "e"], "next");
    expect(await ids()).toEqual(["a", "b", "d", "e", "c"]);
  });

  it("enqueue an existing id moves it, never duplicates", async () => {
    await enqueue(db, U, ["a", "b", "c"], "end");
    await enqueue(db, U, ["a"], "end");
    expect(await ids()).toEqual(["b", "c", "a"]);
    await enqueue(db, U, ["c"], "next");
    expect(await ids()).toEqual(["c", "b", "a"]);
    await enqueue(db, U, ["c"], "next");
    expect(await ids()).toEqual(["c", "b", "a"]);
  });

  it("playing a video keeps it in the queue and makes it the cursor", async () => {
    await enqueue(db, U, ["a", "b", "c"], "end");
    await markPlaying(db, U, "b");
    expect(await ids()).toEqual(["a", "b", "c"]);
    expect(await queueCount(db, U)).toBe(3);
    expect(await queueCursor(db, U)).toBe("b");
    await markPlaying(db, U, "a");
    expect(await queueCursor(db, U)).toBe("a");
  });

  it("markPlaying of a video not in the queue is a no-op", async () => {
    await enqueue(db, U, ["a"], "end");
    await markPlaying(db, U, "e");
    expect(await ids()).toEqual(["a"]);
    expect(await queueCursor(db, U)).toBeNull();
  });

  it("neighbours follow the queue order for a queued video", async () => {
    await enqueue(db, U, ["a", "b", "c"], "end");
    expect(await queueNeighbors(db, U, "a")).toEqual({ prev: null, next: "b" });
    expect(await queueNeighbors(db, U, "b")).toEqual({ prev: "a", next: "c" });
    expect(await queueNeighbors(db, U, "c")).toEqual({ prev: "b", next: null });
  });

  it("a video outside the queue leads back to where the queue stopped", async () => {
    await enqueue(db, U, ["a", "b", "c"], "end");
    expect(await queueNeighbors(db, U, "e")).toEqual({ prev: null, next: "a" });
    await markPlaying(db, U, "b");
    expect(await queueNeighbors(db, U, "e")).toEqual({ prev: null, next: "b" });
  });

  it("resume id is the last played video, or the first one", async () => {
    expect(await queueResumeId(db, U)).toBeNull();
    await enqueue(db, U, ["a", "b", "c"], "end");
    expect(await queueResumeId(db, U)).toBe("a");
    await markPlaying(db, U, "c");
    expect(await queueResumeId(db, U)).toBe("c");
    await removeFromQueue(db, U, "c");
    expect(await queueResumeId(db, U)).toBe("a");
  });

  it("neighbours and listing skip invisible videos", async () => {
    await enqueue(db, U, ["a", "b", "c"], "end");
    await db.update(videos).set({ isLiveRecording: true }).where(eq(videos.id, "b"));
    expect(await ids()).toEqual(["a", "c"]);
    expect(await queueNeighbors(db, U, "a")).toEqual({ prev: null, next: "c" });
    expect(await queueCount(db, U)).toBe(2);
  });

  it("clear, replace, move, remove and count", async () => {
    await enqueue(db, U, ["a", "b", "c"], "end");
    await markPlaying(db, U, "a");
    await moveInQueue(db, U, "c", 0);
    expect(await ids()).toEqual(["c", "a", "b"]);
    await moveInQueue(db, U, "c", 2);
    expect(await ids()).toEqual(["a", "b", "c"]);
    expect(await queueCursor(db, U)).toBe("a");
    await removeFromQueue(db, U, "b");
    expect(await ids()).toEqual(["a", "c"]);
    expect(await queueCount(db, U)).toBe(2);
    await replaceQueue(db, U, ["d", "e"]);
    expect(await ids()).toEqual(["d", "e"]);
    expect(await queueCursor(db, U)).toBeNull();
    await clearQueue(db, U);
    expect(await ids()).toEqual([]);
    expect(await queueCount(db, U)).toBe(0);
  });
});
