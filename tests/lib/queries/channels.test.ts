import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../helpers/db";
import { NOW } from "../../helpers/fake-youtube";
import { CH_A, CH_B, insertChannel, insertUser, insertVideo, U } from "../../helpers/fixtures";
import { channels, playlistItems, playlists } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import {
  CategoryNameTakenError,
  createCategory,
  deleteCategory,
  listCategories,
  listChannels,
  followChannel,
  removeChannel,
  renameCategory,
  setChannelInCategory,
  upsertChannel,
} from "@/lib/queries/channels";
import { getVisibleVideo, listFeed, searchVideos } from "@/lib/queries/videos";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

describe("channels", () => {
  it("upsertChannel inserts with the uploads playlist id and lists it", async () => {
    await upsertChannel(db, { id: CH_A, title: "Canal A", handle: "@a", avatarUrl: "a.jpg" });
    expect(await listChannels(db, U)).toEqual([]);
    await followChannel(db, U, CH_A);
    const [c] = await listChannels(db, U);
    expect(c).toMatchObject({ id: CH_A, title: "Canal A", handle: "@a", avatarUrl: "a.jpg", categoryIds: [] });
    const [row] = await db.select().from(channels).where(eq(channels.id, CH_A));
    expect(row.uploadsPlaylistId).toBe("UUaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("removeChannel hides its videos from feed and search but keeps them in playlists", async () => {
    await insertChannel(db, CH_A);
    await insertVideo(db, "v", { title: "Arquitetura limpa" });
    const [wl] = await db.select().from(playlists);
    await db.insert(playlistItems).values({ playlistId: wl.id, videoId: "v", position: 0 });

    await removeChannel(db, U, CH_A);
    expect((await listFeed(db, U, { now: NOW, limit: 10 })).items).toHaveLength(0);
    expect((await searchVideos(db, U, "arquitetura", { limit: 10 })).items).toHaveLength(0);
    expect(await getVisibleVideo(db, U, "v")).not.toBeNull();
    expect(await db.select().from(playlistItems)).toHaveLength(1);
    expect(await listChannels(db, U)).toHaveLength(0);
  });

  it("re-adding a removed channel reactivates it, refreshes title/avatar and keeps its categories", async () => {
    await insertChannel(db, CH_A);
    const cat = await createCategory(db, U, "Tech");
    await setChannelInCategory(db, U, CH_A, cat, true);
    await removeChannel(db, U, CH_A);
    expect((await db.select().from(channels))[0].removedAt).not.toBeNull();
    await upsertChannel(db, { id: CH_A, title: "Novo nome", handle: null, avatarUrl: "n.jpg" });
    await followChannel(db, U, CH_A);
    const [c] = await listChannels(db, U);
    expect(c).toMatchObject({ id: CH_A, title: "Novo nome", avatarUrl: "n.jpg", categoryIds: [cat] });
    expect((await db.select().from(channels))[0].removedAt).toBeNull();
  });

  it("a channel keeps syncing while another user still follows it", async () => {
    const other = await insertUser(db, "outra");
    await insertChannel(db, CH_A, {}, [U, other]);
    await removeChannel(db, U, CH_A);
    expect(await listChannels(db, U)).toEqual([]);
    expect(await listChannels(db, other)).toHaveLength(1);
    expect((await db.select().from(channels))[0].removedAt).toBeNull();
  });

  it("lists channels alphabetically", async () => {
    await insertChannel(db, CH_B, { title: "beta" });
    await insertChannel(db, CH_A, { title: "Alfa" });
    expect((await listChannels(db, U)).map((c) => c.title)).toEqual(["Alfa", "beta"]);
  });
});

describe("categories", () => {
  it('createCategory without a name picks the first free "Nova categoria" name', async () => {
    await createCategory(db, U);
    await createCategory(db, U);
    expect((await listCategories(db, U)).map((c) => c.name)).toEqual(["Nova categoria", "Nova categoria 2"]);
  });

  it("category names are unique ignoring case; a case change of its own name is allowed", async () => {
    const a = await createCategory(db, U, "Música");
    await expect(createCategory(db, U, "MÚSICA")).rejects.toBeInstanceOf(CategoryNameTakenError);
    const b = await createCategory(db, U, "Ciência");
    await expect(renameCategory(db, U, b, "música")).rejects.toBeInstanceOf(CategoryNameTakenError);
    await renameCategory(db, U, a, "música");
    expect((await listCategories(db, U)).map((c) => c.name)).toEqual(["música", "Ciência"]);
  });

  it("lists categories with active channel counts and no image by default", async () => {
    const cat = await createCategory(db, U, "Tech");
    await insertChannel(db, CH_A);
    await insertChannel(db, CH_B);
    await setChannelInCategory(db, U, CH_A, cat, true);
    await setChannelInCategory(db, U, CH_B, cat, true);
    await removeChannel(db, U, CH_B);
    expect(await listCategories(db, U)).toEqual([
      { id: cat, name: "Tech", imageSrc: "", channelCount: 1, hiddenFromHome: false },
    ]);
  });

  it("create, rename, list in creation order", async () => {
    const a = await createCategory(db, U, "Programação");
    await createCategory(db, U, "Finanças");
    await renameCategory(db, U, a, "Código");
    expect((await listCategories(db, U)).map((c) => c.name)).toEqual(["Código", "Finanças"]);
  });

  it("createCategory rejects duplicate and blank names", async () => {
    await createCategory(db, U, "Música");
    await expect(createCategory(db, U, "Música")).rejects.toThrow();
    await expect(createCategory(db, U, "   ")).rejects.toThrow();
  });

  it("a channel can be in several categories; adding twice is harmless; deleting a category unlinks it", async () => {
    await insertChannel(db, CH_A);
    const a = await createCategory(db, U, "Ciência");
    const b = await createCategory(db, U, "Tech");
    await setChannelInCategory(db, U, CH_A, b, true);
    await setChannelInCategory(db, U, CH_A, a, true);
    await setChannelInCategory(db, U, CH_A, a, true);
    expect((await listChannels(db, U))[0].categoryIds).toEqual([a, b]);
    await setChannelInCategory(db, U, CH_A, b, false);
    expect((await listChannels(db, U))[0].categoryIds).toEqual([a]);
    await deleteCategory(db, U, a);
    expect((await listChannels(db, U))[0].categoryIds).toEqual([]);
  });

});

describe("channel list avatar source", () => {
  it("is empty until the avatar is stored, then the local route", async () => {
    await insertChannel(db, CH_A);
    expect((await listChannels(db, U))[0].avatarSrc).toBe("");
    await db
      .update(channels)
      .set({ avatarData: "AQID", avatarContentType: "image/png", avatarFetchedAt: new Date("2026-11-01T00:00:00Z") })
      .where(eq(channels.id, CH_A));
    expect((await listChannels(db, U))[0].avatarSrc).toBe(`/avatar/${CH_A}?v=1793491200`);
  });
});
