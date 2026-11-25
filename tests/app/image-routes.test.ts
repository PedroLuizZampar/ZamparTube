import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../helpers/db";
import { insertUser, U } from "../helpers/fixtures";
import type { Db } from "@/lib/db/client";
import { createCategory } from "@/lib/queries/channels";
import { setImage } from "@/lib/queries/images";
import { createPlaylist } from "@/lib/queries/playlists";

let db: Db;
let signedIn: number | null = U;
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
vi.mock("@/lib/auth/require", () => ({ currentUserId: async () => signedIn }));
const category = await import("@/app/category-image/[id]/route");
const playlist = await import("@/app/playlist-image/[id]/route");

const call = (GET: typeof category.GET, id: string) =>
  GET(new Request(`http://x/img/${id}`), { params: Promise.resolve({ id }) });

describe("image routes", () => {
  beforeEach(async () => {
    db = await createTestDb();
    signedIn = U;
  });

  it("404 for another user's picture and without a session", async () => {
    const c = await createCategory(db, U, "Tech");
    await setImage(db, U, "category", c, { data: Buffer.from([1]).toString("base64"), contentType: "image/webp" });
    signedIn = await insertUser(db, "outra");
    expect((await call(category.GET, String(c))).status).toBe(404);
    signedIn = null;
    expect((await call(category.GET, String(c))).status).toBe(404);
  });

  it("serve the stored category and playlist images with long cache headers", async () => {
    const c = await createCategory(db, U, "Tech");
    const p = await createPlaylist(db, U, "Estudos");
    await setImage(db, U, "category", c, { data: Buffer.from([1, 2]).toString("base64"), contentType: "image/webp" });
    await setImage(db, U, "playlist", p, { data: Buffer.from([3]).toString("base64"), contentType: "image/jpeg" });

    const rc = await call(category.GET, String(c));
    expect(rc.status).toBe(200);
    expect(rc.headers.get("content-type")).toBe("image/webp");
    expect(rc.headers.get("cache-control")).toMatch(/max-age=\d{5,}/);
    expect(new Uint8Array(await rc.arrayBuffer())).toEqual(new Uint8Array([1, 2]));

    const rp = await call(playlist.GET, String(p));
    expect(rp.headers.get("content-type")).toBe("image/jpeg");
  });

  it("404 without an image or with a bad id", async () => {
    const c = await createCategory(db, U, "Tech");
    expect((await call(category.GET, String(c))).status).toBe(404);
    expect((await call(category.GET, "abc")).status).toBe(404);
    expect((await call(playlist.GET, "999")).status).toBe(404);
  });
});
