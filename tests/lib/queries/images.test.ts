import { beforeEach, describe, expect, it } from "vitest";
import { U } from "../../helpers/fixtures";
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
    const id = await createCategory(db, U, "Tech");
    await setImage(db, U, "category", id, img);
    expect(await getImage(db, U, "category", id)).toEqual(img);
    const [c] = await listCategories(db, U);
    expect(c.imageSrc).toMatch(/^\/category-image\/\d+\?v=\d+$/);
    expect(c.imageSrc.startsWith(`/category-image/${id}?`)).toBe(true);

    await setImage(db, U, "category", id, null);
    expect(await getImage(db, U, "category", id)).toBeNull();
    expect((await listCategories(db, U))[0].imageSrc).toBe("");
  });

  it("changes the image URL when the image is replaced", async () => {
    const id = await createPlaylist(db, U, "Estudos");
    await setImage(db, U, "playlist", id, img);
    const first = (await listPlaylists(db, U)).find((p) => p.id === id)!.imageSrc;
    await new Promise((r) => setTimeout(r, 5));
    await setImage(db, U, "playlist", id, { ...img, contentType: "image/jpeg" });
    const second = (await listPlaylists(db, U)).find((p) => p.id === id)!.imageSrc;
    expect(first.startsWith(`/playlist-image/${id}?v=`)).toBe(true);
    expect(second).not.toBe(first);
  });

  it("returns null for a missing row", async () => {
    expect(await getImage(db, U, "playlist", 999)).toBeNull();
  });
});
