import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../helpers/db";
import type { Db } from "@/lib/db/client";
import { createCategory, listCategories } from "@/lib/queries/channels";
import { getImage, setImage } from "@/lib/queries/images";
import { createPlaylist, listPlaylists } from "@/lib/queries/playlists";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

const img = { data: Buffer.from("fake").toString("base64"), contentType: "image/webp" };

describe("images", () => {
  it("stores, serves and clears a category image", async () => {
    const id = await createCategory(db, "Tech");
    await setImage(db, "category", id, img);
    expect(await getImage(db, "category", id)).toEqual(img);
    const [c] = await listCategories(db);
    expect(c.imageSrc).toMatch(/^\/category-image\/\d+\?v=\d+$/);
    expect(c.imageSrc.startsWith(`/category-image/${id}?`)).toBe(true);

    await setImage(db, "category", id, null);
    expect(await getImage(db, "category", id)).toBeNull();
    expect((await listCategories(db))[0].imageSrc).toBe("");
  });

  it("changes the image URL when the image is replaced", async () => {
    const id = await createPlaylist(db, "Estudos");
    await setImage(db, "playlist", id, img);
    const first = (await listPlaylists(db)).find((p) => p.id === id)!.imageSrc;
    await new Promise((r) => setTimeout(r, 5));
    await setImage(db, "playlist", id, { ...img, contentType: "image/jpeg" });
    const second = (await listPlaylists(db)).find((p) => p.id === id)!.imageSrc;
    expect(first.startsWith(`/playlist-image/${id}?v=`)).toBe(true);
    expect(second).not.toBe(first);
  });

  it("returns null for a missing row", async () => {
    expect(await getImage(db, "playlist", 999)).toBeNull();
  });
});
