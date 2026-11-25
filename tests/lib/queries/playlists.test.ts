import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../helpers/db";
import { CH_A, insertChannel, insertVideo, U } from "../../helpers/fixtures";
import { playlistItems, playlists, videos, watchState } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import {
  addToPlaylist,
  createPlaylist,
  deletePlaylist,
  getNextInPlaylist,
  getPrevInPlaylist,
  getPlaylist,
  getWatchLaterId,
  listPlaylists,
  listPlaylistVideos,
  moveInPlaylist,
  PlaylistNameTakenError,
  playlistsContaining,
  readWatchLaterName,
  removeFromPlaylist,
  renamePlaylist,
} from "@/lib/queries/playlists";

let db: Db;
let wl: number;

beforeEach(async () => {
  db = await createTestDb();
  await insertChannel(db, CH_A);
  for (const id of ["a", "b", "c", "d"]) await insertVideo(db, id);
  wl = await getWatchLaterId(db, U);
});

const order = async (p: number) => (await listPlaylistVideos(db, U, p)).map((v) => v.id);

describe("playlists", () => {
  it("never lists a live recording, even if it was saved", async () => {
    await insertVideo(db, "rec", { liveState: "ended", isLiveRecording: true });
    await addToPlaylist(db, U, wl, "a");
    await addToPlaylist(db, U, wl, "rec");
    expect(await order(wl)).toEqual(["a"]);
  });

  it("lists watch later first, then others, with counts and cover", async () => {
    const p = await createPlaylist(db, U, "Estudos");
    await addToPlaylist(db, U, p, "b");
    await addToPlaylist(db, U, wl, "a");
    const rows = await listPlaylists(db, U);
    expect(rows.map((r) => r.name)).toEqual(["Assistir depois", "Estudos"]);
    expect(rows[0]).toMatchObject({ isWatchLater: true, count: 1, coverThumbnailUrl: "t-a.jpg" });
    expect(rows[1]).toMatchObject({ isWatchLater: false, count: 1 });
  });

  it("watch later cannot be deleted; normal playlists can, and rename works", async () => {
    await expect(deletePlaylist(db, U, wl)).rejects.toThrow();
    const p = await createPlaylist(db, U, "X");
    await renamePlaylist(db, U, p, "Y");
    expect((await getPlaylist(db, U, p))?.name).toBe("Y");
    await deletePlaylist(db, U, p);
    expect(await getPlaylist(db, U, p)).toBeNull();
  });

  it('createPlaylist without a name picks the first free "Nova playlist" name', async () => {
    const a = await createPlaylist(db, U);
    const b = await createPlaylist(db, U);
    const c = await createPlaylist(db, U);
    expect(new Set([a, b, c]).size).toBe(3);
    expect((await listPlaylists(db, U)).map((p) => p.name)).toEqual([
      "Assistir depois",
      "Nova playlist",
      "Nova playlist 2",
      "Nova playlist 3",
    ]);
  });

  it("createPlaylist rejects a name already used, ignoring case", async () => {
    await createPlaylist(db, U, "Estudos");
    await expect(createPlaylist(db, U, "estudos")).rejects.toBeInstanceOf(PlaylistNameTakenError);
    await expect(createPlaylist(db, U, " ASSISTIR DEPOIS ")).rejects.toBeInstanceOf(PlaylistNameTakenError);
  });

  it("renamePlaylist rejects another playlist's name but accepts a case change of its own", async () => {
    await createPlaylist(db, U, "Estudos");
    const p = await createPlaylist(db, U, "Música");
    await expect(renamePlaylist(db, U, p, "ESTUDOS")).rejects.toBeInstanceOf(PlaylistNameTakenError);
    await renamePlaylist(db, U, p, "música");
    expect((await getPlaylist(db, U, p))?.name).toBe("música");
  });

  it("readWatchLaterName only reads: the stored name, or the default when the row is missing", async () => {
    await renamePlaylist(db, U, wl, "Depois");
    expect(await readWatchLaterName(db, U)).toBe("Depois");
    await db.delete(playlists).where(eq(playlists.id, wl));
    expect(await readWatchLaterName(db, U)).toBe("Assistir depois");
    expect(await listPlaylists(db, U)).toEqual([]);
  });

  it("renamePlaylist renames Assistir depois too, keeping it the watch-later list and unique", async () => {
    await createPlaylist(db, U, "Estudos");
    await renamePlaylist(db, U, wl, "Ver mais tarde");
    expect(await getPlaylist(db, U, wl)).toMatchObject({ name: "Ver mais tarde", isWatchLater: true });
    expect(await readWatchLaterName(db, U)).toBe("Ver mais tarde");
    expect(await getWatchLaterId(db, U)).toBe(wl);
    await expect(renamePlaylist(db, U, wl, "estudos")).rejects.toBeInstanceOf(PlaylistNameTakenError);
    await expect(deletePlaylist(db, U, wl)).rejects.toThrow();
  });

  it("the database refuses duplicate names", async () => {
    await createPlaylist(db, U, "Estudos");
    await expect(db.insert(playlists).values({ userId: U, name: "ESTUDOS" })).rejects.toThrow();
  });

  it("createPlaylist rejects a blank name", async () => {
    await expect(createPlaylist(db, U, "  ")).rejects.toThrow();
  });

  it("addToPlaylist appends at the end and is idempotent", async () => {
    await addToPlaylist(db, U, wl, "a");
    await addToPlaylist(db, U, wl, "b");
    await addToPlaylist(db, U, wl, "a");
    expect(await order(wl)).toEqual(["a", "b"]);
  });

  it("moveInPlaylist swaps with the neighbour and is a no-op at the edges", async () => {
    for (const id of ["a", "b", "c"]) await addToPlaylist(db, U, wl, id);
    await moveInPlaylist(db, U, wl, "c", "up");
    expect(await order(wl)).toEqual(["a", "c", "b"]);
    await moveInPlaylist(db, U, wl, "a", "up");
    expect(await order(wl)).toEqual(["a", "c", "b"]);
    await moveInPlaylist(db, U, wl, "b", "down");
    expect(await order(wl)).toEqual(["a", "c", "b"]);
    await moveInPlaylist(db, U, wl, "a", "down");
    expect(await order(wl)).toEqual(["c", "a", "b"]);
  });

  it("moveInPlaylist skips hidden videos when picking the neighbour", async () => {
    for (const id of ["a", "b", "c"]) await addToPlaylist(db, U, wl, id);
    await db.update(videos).set({ isShort: true, shortsCheck: "short" }).where(eq(videos.id, "b"));
    await moveInPlaylist(db, U, wl, "c", "up");
    expect(await order(wl)).toEqual(["c", "a"]);
  });

  it("removeFromPlaylist removes only that item", async () => {
    await addToPlaylist(db, U, wl, "a");
    await addToPlaylist(db, U, wl, "b");
    await removeFromPlaylist(db, U, wl, "a");
    expect(await order(wl)).toEqual(["b"]);
  });

  it("listPlaylistVideos hides a video that later became a short", async () => {
    await addToPlaylist(db, U, wl, "a");
    await addToPlaylist(db, U, wl, "b");
    await db.update(videos).set({ isShort: true, shortsCheck: "short" }).where(eq(videos.id, "a"));
    expect(await order(wl)).toEqual(["b"]);
  });

  it("getNextInPlaylist returns the next visible item, or null at the end", async () => {
    for (const id of ["a", "b", "c"]) await addToPlaylist(db, U, wl, id);
    await db.update(videos).set({ shortsCheck: "pending", durationSeconds: 60 }).where(eq(videos.id, "b"));
    expect(await getNextInPlaylist(db, U, wl, "a")).toBe("c");
    expect(await getNextInPlaylist(db, U, wl, "c")).toBeNull();
    expect(await getNextInPlaylist(db, U, wl, "zzz")).toBeNull();
  });

  it("getPrevInPlaylist returns the previous visible item, or null at the start", async () => {
    for (const id of ["a", "b", "c"]) await addToPlaylist(db, U, wl, id);
    expect(await getPrevInPlaylist(db, U, wl, "c")).toBe("b");
    expect(await getPrevInPlaylist(db, U, wl, "a")).toBeNull();
    await db.update(videos).set({ shortsCheck: "pending", durationSeconds: 60 }).where(eq(videos.id, "b"));
    expect(await getPrevInPlaylist(db, U, wl, "c")).toBe("a");
    expect(await getPrevInPlaylist(db, U, wl, "zzz")).toBeNull();
  });

  it("deleting a video row cascades out of playlists", async () => {
    await addToPlaylist(db, U, wl, "a");
    await db.delete(videos).where(eq(videos.id, "a"));
    expect(await db.select().from(playlistItems)).toHaveLength(0);
  });

  it("playlistsContaining lists the playlists that hold a video", async () => {
    const p = await createPlaylist(db, U, "Estudos");
    await addToPlaylist(db, U, p, "a");
    await addToPlaylist(db, U, wl, "a");
    expect((await playlistsContaining(db, U, "a")).sort()).toEqual([wl, p].sort());
    expect(await playlistsContaining(db, U, "b")).toEqual([]);
  });

  it("firstUnwatched helper: listPlaylistVideos carries watched flags", async () => {
    await addToPlaylist(db, U, wl, "a");
    await addToPlaylist(db, U, wl, "b");
    await db.insert(watchState).values({ userId: U, videoId: "a", watched: true });
    const vids = await listPlaylistVideos(db, U, wl);
    expect(vids.map((v) => [v.id, v.watched])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });
});
