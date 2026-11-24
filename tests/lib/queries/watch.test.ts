import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../helpers/db";
import { NOW } from "../../helpers/fake-youtube";
import { CH_A, insertChannel, insertVideo } from "../../helpers/fixtures";
import { videos, watchState } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { listFeed } from "@/lib/queries/videos";
import { clearWatchState, dismissFromFeed, saveProgress, setWatched } from "@/lib/queries/watch";
import { addToPlaylist, getWatchLaterId, listPlaylistVideos } from "@/lib/queries/playlists";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
  await insertChannel(db, CH_A);
  await insertVideo(db, "v", { durationSeconds: 1000 });
});

async function state() {
  const [r] = await db.select().from(watchState).where(eq(watchState.videoId, "v"));
  return r;
}

describe("watch state", () => {
  it("saveProgress stores the position without marking watched below 90%", async () => {
    expect(await saveProgress(db, "v", 500, 1000)).toEqual({ watched: false });
    expect(await state()).toMatchObject({ positionSeconds: 500, watched: false });
  });

  it("saveProgress at 90% marks watched; a later lower position keeps it watched", async () => {
    expect(await saveProgress(db, "v", 900, 1000)).toEqual({ watched: true });
    expect(await saveProgress(db, "v", 10, 1000)).toEqual({ watched: true });
    expect(await state()).toMatchObject({ positionSeconds: 10, watched: true });
    expect((await listFeed(db, { now: NOW, limit: 10 })).items).toHaveLength(0);
  });

  it("setWatched toggles both ways", async () => {
    await setWatched(db, "v", true);
    expect((await state()).watched).toBe(true);
    await setWatched(db, "v", false);
    expect((await state()).watched).toBe(false);
  });

  it("dismissFromFeed hides from the feed but does not mark watched", async () => {
    await dismissFromFeed(db, "v");
    expect((await listFeed(db, { now: NOW, limit: 10 })).items).toHaveLength(0);
    const [v] = await db.select().from(videos).where(eq(videos.id, "v"));
    expect(v.dismissedAt).not.toBeNull();
    expect(await state()).toBeUndefined();
  });

  it("clearWatchState removes progress and watched, keeps playlists", async () => {
    await saveProgress(db, "v", 950, 1000);
    const wl = await getWatchLaterId(db);
    await addToPlaylist(db, wl, "v");
    await clearWatchState(db, "v");
    expect(await state()).toBeUndefined();
    expect((await listPlaylistVideos(db, wl)).map((x) => x.id)).toEqual(["v"]);
    expect((await listFeed(db, { now: NOW, limit: 10 })).items.map((x) => x.id)).toEqual(["v"]);
  });
});
