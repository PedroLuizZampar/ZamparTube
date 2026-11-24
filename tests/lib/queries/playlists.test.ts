import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../helpers/db";
import { CH_A, insertChannel, insertVideo } from "../../helpers/fixtures";
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
  wl = await getWatchLaterId(db);
});

const order = async (p: number) => (await listPlaylistVideos(db, p)).map((v) => v.id);

describe("playlists", () => {
  it("never lists a live recording, even if it was saved", async () => {
    await insertVideo(db, "rec", { liveState: "ended", isLiveRecording: true });
    await addToPlaylist(db, wl, "a");
    await addToPlaylist(db, wl, "rec");
    expect(await order(wl)).toEqual(["a"]);
  });

  it("lists watch later first, then others, with counts and cover", async () => {
    const p = await createPlaylist(db, "Estudos");
    await addToPlaylist(db, p, "b");
    await addToPlaylist(db, wl, "a");
    const rows = await listPlaylists(db);
    expect(rows.map((r) => r.name)).toEqual(["Assistir depois", "Estudos"]);
    expect(rows[0]).toMatchObject({ isWatchLater: true, count: 1, coverThumbnailUrl: "t-a.jpg" });
    expect(rows[1]).toMatchObject({ isWatchLater: false, count: 1 });
  });

  it("watch later cannot be deleted; normal playlists can, and rename works", async () => {
    await expect(deletePlaylist(db, wl)).rejects.toThrow();
    const p = await createPlaylist(db, "X");
    await renamePlaylist(db, p, "Y");
    expect((await getPlaylist(db, p))?.name).toBe("Y");
    await deletePlaylist(db, p);
    expect(await getPlaylist(db, p)).toBeNull();
  });

  it('createPlaylist without a name picks the first free "Nova playlist" name', async () => {
    const a = await createPlaylist(db);
    const b = await createPlaylist(db);
    const c = await createPlaylist(db);
    expect(new Set([a, b, c]).size).toBe(3);
    expect((await listPlaylists(db)).map((p) => p.name)).toEqual([
      "Assistir depois",
      "Nova playlist",
      "Nova playlist 2",
      "Nova playlist 3",
    ]);
  });

  it("createPlaylist rejects a name already used, ignoring case", async () => {
    await createPlaylist(db, "Estudos");
    await expect(createPlaylist(db, "estudos")).rejects.toBeInstanceOf(PlaylistNameTakenError);
    await expect(createPlaylist(db, " ASSISTIR DEPOIS ")).rejects.toBeInstanceOf(PlaylistNameTakenError);
  });

  it("renamePlaylist rejects another playlist's name but accepts a case change of its own", async () => {
    await createPlaylist(db, "Estudos");
    const p = await createPlaylist(db, "Música");
    await expect(renamePlaylist(db, p, "ESTUDOS")).rejects.toBeInstanceOf(PlaylistNameTakenError);
    await renamePlaylist(db, p, "música");
    expect((await getPlaylist(db, p))?.name).toBe("música");
  });

  it("readWatchLaterName only reads: the stored name, or the default when the row is missing", async () => {
    await renamePlaylist(db, wl, "Depois");
    expect(await readWatchLaterName(db)).toBe("Depois");
    await db.delete(playlists).where(eq(playlists.id, wl));
    expect(await readWatchLaterName(db)).toBe("Assistir depois");
    expect(await listPlaylists(db)).toEqual([]);
  });

  it("renamePlaylist renames Assistir depois too, keeping it the watch-later list and unique", async () => {
    await createPlaylist(db, "Estudos");
    await renamePlaylist(db, wl, "Ver mais tarde");
    expect(await getPlaylist(db, wl)).toMatchObject({ name: "Ver mais tarde", isWatchLater: true });
    expect(await readWatchLaterName(db)).toBe("Ver mais tarde");
    expect(await getWatchLaterId(db)).toBe(wl);
    await expect(renamePlaylist(db, wl, "estudos")).rejects.toBeInstanceOf(PlaylistNameTakenError);
    await expect(deletePlaylist(db, wl)).rejects.toThrow();
  });

  it("the database refuses duplicate names", async () => {
    await createPlaylist(db, "Estudos");
    await expect(db.insert(playlists).values({ name: "ESTUDOS" })).rejects.toThrow();
  });

  it("createPlaylist rejects a blank name", async () => {
    await expect(createPlaylist(db, "  ")).rejects.toThrow();
  });

  it("addToPlaylist appends at the end and is idempotent", async () => {
    await addToPlaylist(db, wl, "a");
    await addToPlaylist(db, wl, "b");
    await addToPlaylist(db, wl, "a");
    expect(await order(wl)).toEqual(["a", "b"]);
  });

  it("moveInPlaylist swaps with the neighbour and is a no-op at the edges", async () => {
    for (const id of ["a", "b", "c"]) await addToPlaylist(db, wl, id);
    await moveInPlaylist(db, wl, "c", "up");
    expect(await order(wl)).toEqual(["a", "c", "b"]);
    await moveInPlaylist(db, wl, "a", "up");
    expect(await order(wl)).toEqual(["a", "c", "b"]);
    await moveInPlaylist(db, wl, "b", "down");
    expect(await order(wl)).toEqual(["a", "c", "b"]);
    await moveInPlaylist(db, wl, "a", "down");
    expect(await order(wl)).toEqual(["c", "a", "b"]);
  });

  it("moveInPlaylist skips hidden videos when picking the neighbour", async () => {
    for (const id of ["a", "b", "c"]) await addToPlaylist(db, wl, id);
    await db.update(videos).set({ isShort: true, shortsCheck: "short" }).where(eq(videos.id, "b"));
    await moveInPlaylist(db, wl, "c", "up");
    expect(await order(wl)).toEqual(["c", "a"]);
  });

  it("removeFromPlaylist removes only that item", async () => {
    await addToPlaylist(db, wl, "a");
    await addToPlaylist(db, wl, "b");
    await removeFromPlaylist(db, wl, "a");
    expect(await order(wl)).toEqual(["b"]);
  });

  it("listPlaylistVideos hides a video that later became a short", async () => {
    await addToPlaylist(db, wl, "a");
    await addToPlaylist(db, wl, "b");
    await db.update(videos).set({ isShort: true, shortsCheck: "short" }).where(eq(videos.id, "a"));
    expect(await order(wl)).toEqual(["b"]);
  });

  it("getNextInPlaylist returns the next visible item, or null at the end", async () => {
    for (const id of ["a", "b", "c"]) await addToPlaylist(db, wl, id);
    await db.update(videos).set({ shortsCheck: "pending", durationSeconds: 60 }).where(eq(videos.id, "b"));
    expect(await getNextInPlaylist(db, wl, "a")).toBe("c");
    expect(await getNextInPlaylist(db, wl, "c")).toBeNull();
    expect(await getNextInPlaylist(db, wl, "zzz")).toBeNull();
  });

  it("getPrevInPlaylist returns the previous visible item, or null at the start", async () => {
    for (const id of ["a", "b", "c"]) await addToPlaylist(db, wl, id);
    expect(await getPrevInPlaylist(db, wl, "c")).toBe("b");
    expect(await getPrevInPlaylist(db, wl, "a")).toBeNull();
    await db.update(videos).set({ shortsCheck: "pending", durationSeconds: 60 }).where(eq(videos.id, "b"));
    expect(await getPrevInPlaylist(db, wl, "c")).toBe("a");
    expect(await getPrevInPlaylist(db, wl, "zzz")).toBeNull();
  });

  it("deleting a video row cascades out of playlists", async () => {
    await addToPlaylist(db, wl, "a");
    await db.delete(videos).where(eq(videos.id, "a"));
    expect(await db.select().from(playlistItems)).toHaveLength(0);
  });

  it("playlistsContaining lists the playlists that hold a video", async () => {
    const p = await createPlaylist(db, "Estudos");
    await addToPlaylist(db, p, "a");
    await addToPlaylist(db, wl, "a");
    expect((await playlistsContaining(db, "a")).sort()).toEqual([wl, p].sort());
    expect(await playlistsContaining(db, "b")).toEqual([]);
  });

  it("firstUnwatched helper: listPlaylistVideos carries watched flags", async () => {
    await addToPlaylist(db, wl, "a");
    await addToPlaylist(db, wl, "b");
    await db.insert(watchState).values({ videoId: "a", watched: true });
    const vids = await listPlaylistVideos(db, wl);
    expect(vids.map((v) => [v.id, v.watched])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });
});
