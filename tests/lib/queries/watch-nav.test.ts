import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../helpers/db";
import { CH_A, insertChannel, insertVideo } from "../../helpers/fixtures";
import type { Db } from "@/lib/db/client";
import { addToPlaylist, createPlaylist } from "@/lib/queries/playlists";
import { enqueue, markPlaying } from "@/lib/queries/queue";
import { resolveWatchNav } from "@/lib/queries/watch-nav";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
  await insertChannel(db, CH_A);
  for (const id of ["a", "b", "c"]) await insertVideo(db, id);
});

describe("resolveWatchNav", () => {
  it("follows the playlist when a list id is given", async () => {
    const p = await createPlaylist(db, "Estudos");
    for (const id of ["a", "b", "c"]) await addToPlaylist(db, p, id);
    await enqueue(db, ["c"], "end");
    const nav = await resolveWatchNav(db, "b", p);
    expect(nav.source).toBe("playlist");
    expect(nav.prev).toEqual({ id: "a", title: "Vídeo a", thumbnailUrl: "t-a.jpg", href: `/watch/a?list=${p}` });
    expect(nav.next?.href).toBe(`/watch/c?list=${p}`);
  });

  it("follows the queue without a list id", async () => {
    await enqueue(db, ["a", "b"], "end");
    await markPlaying(db, "a");
    const nav = await resolveWatchNav(db, "a", null);
    expect(nav.source).toBe("queue");
    expect(nav.prev).toBeNull();
    expect(nav.next).toEqual({ id: "b", title: "Vídeo b", thumbnailUrl: "t-b.jpg", href: "/watch/b" });
  });

  it("has nowhere to go with an empty queue", async () => {
    expect(await resolveWatchNav(db, "a", null)).toEqual({ prev: null, next: null, source: "queue" });
  });
});
