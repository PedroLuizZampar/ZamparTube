import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../helpers/db";
import { CH_A, CH_B, insertChannel, insertVideo } from "../../helpers/fixtures";
import { channels, playlistItems, playlists } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import {
  createCategory,
  deleteCategory,
  listCategories,
  listChannels,
  removeChannel,
  renameCategory,
  setChannelCategory,
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
    const [c] = await listChannels(db);
    expect(c).toMatchObject({ id: CH_A, title: "Canal A", handle: "@a", avatarUrl: "a.jpg", categoryId: null });
    const [row] = await db.select().from(channels).where(eq(channels.id, CH_A));
    expect(row.uploadsPlaylistId).toBe("UUaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("removeChannel hides its videos from feed and search but keeps them in playlists", async () => {
    await insertChannel(db, CH_A);
    await insertVideo(db, "v", { title: "Arquitetura limpa" });
    const [wl] = await db.select().from(playlists);
    await db.insert(playlistItems).values({ playlistId: wl.id, videoId: "v", position: 0 });

    await removeChannel(db, CH_A);
    expect((await listFeed(db, { limit: 10 })).items).toHaveLength(0);
    expect((await searchVideos(db, "arquitetura", { limit: 10 })).items).toHaveLength(0);
    expect(await getVisibleVideo(db, "v")).not.toBeNull();
    expect(await db.select().from(playlistItems)).toHaveLength(1);
    expect(await listChannels(db)).toHaveLength(0);
  });

  it("upsertChannel on a removed channel reactivates it and refreshes title/avatar", async () => {
    await insertChannel(db, CH_A);
    await removeChannel(db, CH_A);
    await upsertChannel(db, { id: CH_A, title: "Novo nome", handle: null, avatarUrl: "n.jpg" });
    const [c] = await listChannels(db);
    expect(c).toMatchObject({ id: CH_A, title: "Novo nome", avatarUrl: "n.jpg" });
  });

  it("lists channels alphabetically", async () => {
    await insertChannel(db, CH_B, { title: "beta" });
    await insertChannel(db, CH_A, { title: "Alfa" });
    expect((await listChannels(db)).map((c) => c.title)).toEqual(["Alfa", "beta"]);
  });
});

describe("categories", () => {
  it("create, rename, list in creation order", async () => {
    const a = await createCategory(db, "Programação");
    await createCategory(db, "Finanças");
    await renameCategory(db, a, "Código");
    expect((await listCategories(db)).map((c) => c.name)).toEqual(["Código", "Finanças"]);
  });

  it("createCategory rejects duplicate and blank names", async () => {
    await createCategory(db, "Música");
    await expect(createCategory(db, "Música")).rejects.toThrow();
    await expect(createCategory(db, "   ")).rejects.toThrow();
  });

  it("setChannelCategory and deleteCategory sets channels.categoryId to null", async () => {
    await insertChannel(db, CH_A);
    const cat = await createCategory(db, "Ciência");
    await setChannelCategory(db, CH_A, cat);
    expect((await listChannels(db))[0].categoryId).toBe(cat);
    await deleteCategory(db, cat);
    expect((await listChannels(db))[0].categoryId).toBeNull();
  });
});
