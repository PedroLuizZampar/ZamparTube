import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../helpers/db";
import { NOW } from "../../helpers/fake-youtube";
import { CH_A, insertCategory, insertChannel, insertVideo, U } from "../../helpers/fixtures";
import type { Db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createCategory, listCategories, listChannels, setChannelInCategory } from "@/lib/queries/channels";
import { listContinueWatching } from "@/lib/queries/history";
import { addToPlaylist, getPlaylist, getWatchLaterId, listPlaylists, listPlaylistVideos } from "@/lib/queries/playlists";
import { enqueue, listQueue } from "@/lib/queries/queue";
import {
  createUser,
  findUserByUsername,
  getProfile,
  getUserImage,
  getUsername,
  renameUser,
  setUserImage,
  usernameProblem,
  UsernameTakenError,
} from "@/lib/queries/users";
import { getVisibleVideo, listFeed } from "@/lib/queries/videos";
import { dismissFromFeed, saveProgress } from "@/lib/queries/watch";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

describe("accounts", () => {
  it("the first account takes over the data from before accounts; later ones start empty", async () => {
    await insertChannel(db, CH_A);
    await insertCategory(db, "Antiga");
    const first = await createUser(db, "pedro", "h1");
    expect(first).toBe(U);
    expect(await getUsername(db, first)).toBe("pedro");
    expect(await listChannels(db, first)).toHaveLength(1);
    expect((await listCategories(db, first)).map((c) => c.name)).toEqual(["Antiga"]);

    const second = await createUser(db, "ana", "h2");
    expect(second).not.toBe(first);
    expect(await listChannels(db, second)).toEqual([]);
    expect(await listCategories(db, second)).toEqual([]);
    expect(await db.select().from(users)).toHaveLength(2);
  });

  it("usernames are unique ignoring case", async () => {
    await createUser(db, "Pedro", "h");
    await expect(createUser(db, "pedro", "h")).rejects.toBeInstanceOf(UsernameTakenError);
  });

  it("finds a user case-insensitively, never the placeholder owner", async () => {
    expect(await findUserByUsername(db, "dono")).toBeNull();
    const id = await createUser(db, "Pedro", "hash");
    expect(await findUserByUsername(db, " pedro ")).toEqual({ id, username: "Pedro", passwordHash: "hash" });
    expect(await findUserByUsername(db, "ninguem")).toBeNull();
  });

  it("validates usernames; spaces are allowed", () => {
    expect(usernameProblem("pe")).toMatch(/3 a 30/);
    expect(usernameProblem("  p  ")).toMatch(/3 a 30/);
    expect(usernameProblem("pedro@zampar")).toMatch(/letras/);
    expect(usernameProblem("Pedro Zampar")).toBeNull();
    expect(usernameProblem("joão.silva-2_x")).toBeNull();
  });

  it("stores names with spaces collapsed and finds them however they are typed", async () => {
    const id = await createUser(db, "  Pedro   Zampar ", "hash");
    expect(await getUsername(db, id)).toBe("Pedro Zampar");
    expect((await findUserByUsername(db, "pedro  zampar"))?.id).toBe(id);
  });

  it("renames, keeping names unique ignoring case", async () => {
    const pedro = await createUser(db, "pedro", "h");
    await createUser(db, "ana", "h");
    await expect(renameUser(db, pedro, "ANA")).rejects.toBeInstanceOf(UsernameTakenError);
    await renameUser(db, pedro, "Pedro Zampar");
    expect(await getUsername(db, pedro)).toBe("Pedro Zampar");
    await renameUser(db, pedro, "pedro zampar");
    expect(await getUsername(db, pedro)).toBe("pedro zampar");
    expect(await findUserByUsername(db, "pedro")).toBeNull();
  });

  it("stores, versions and removes the profile photo", async () => {
    const id = await createUser(db, "pedro", "h");
    expect((await getProfile(db, id))?.imageSrc).toBe("");
    const img = { data: Buffer.from("x").toString("base64"), contentType: "image/webp" };
    await setUserImage(db, id, img);
    expect(await getUserImage(db, id)).toEqual(img);
    expect((await getProfile(db, id))?.imageSrc).toMatch(/^\/profile-image\?v=\d+$/);
    await setUserImage(db, id, null);
    expect(await getUserImage(db, id)).toBeNull();
    expect((await getProfile(db, id))?.imageSrc).toBe("");
  });

  it("hashes passwords with a salt and verifies them", async () => {
    const h = await hashPassword("segredo-forte");
    expect(h).not.toContain("segredo-forte");
    expect(await hashPassword("segredo-forte")).not.toBe(h);
    expect(await verifyPassword("segredo-forte", h)).toBe(true);
    expect(await verifyPassword("errada", h)).toBe(false);
    expect(await verifyPassword("segredo-forte", "lixo")).toBe(false);
  });
});

describe("each account sees only its own data", () => {
  let ana: number;

  beforeEach(async () => {
    await createUser(db, "pedro", "h");
    ana = await createUser(db, "ana", "h");
    await insertChannel(db, CH_A, {}, [U, ana]);
    await insertVideo(db, "v");
  });

  it("watch progress, dismissals and history", async () => {
    await saveProgress(db, U, "v", 100, 600);
    expect((await listContinueWatching(db, U, { limit: 10 })).items.map((x) => x.id)).toEqual(["v"]);
    expect((await listContinueWatching(db, ana, { limit: 10 })).items).toEqual([]);
    expect((await getVisibleVideo(db, ana, "v"))?.positionSeconds).toBe(0);

    await dismissFromFeed(db, U, "v");
    expect((await listFeed(db, U, { now: NOW, limit: 10 })).items).toEqual([]);
    expect((await listFeed(db, ana, { now: NOW, limit: 10 })).items.map((x) => x.id)).toEqual(["v"]);
  });

  it("playlists, including the watch-later one", async () => {
    const mine = await getWatchLaterId(db, U);
    const hers = await getWatchLaterId(db, ana);
    expect(hers).not.toBe(mine);
    await addToPlaylist(db, U, mine, "v");
    expect((await getVisibleVideo(db, U, "v"))?.savedForLater).toBe(true);
    expect((await getVisibleVideo(db, ana, "v"))?.savedForLater).toBe(false);
    // Another user's playlist id is useless: not readable, not writable.
    expect(await getPlaylist(db, ana, mine)).toBeNull();
    expect(await listPlaylistVideos(db, ana, mine)).toEqual([]);
    await addToPlaylist(db, ana, mine, "v");
    expect((await listPlaylists(db, ana)).map((p) => p.id)).toEqual([hers]);
  });

  it("categories and the queue", async () => {
    const cat = await createCategory(db, U, "Tech");
    await setChannelInCategory(db, ana, CH_A, cat, true);
    expect((await listChannels(db, U))[0].categoryIds).toEqual([]);
    await setChannelInCategory(db, U, CH_A, cat, true);
    expect((await listChannels(db, U))[0].categoryIds).toEqual([cat]);
    expect((await listChannels(db, ana))[0].categoryIds).toEqual([]);
    // Both can use the same category name.
    await createCategory(db, ana, "Tech");

    await enqueue(db, U, ["v"], "end");
    expect((await listQueue(db, U)).map((x) => x.id)).toEqual(["v"]);
    expect(await listQueue(db, ana)).toEqual([]);
    await enqueue(db, ana, ["v"], "end");
    expect((await listQueue(db, ana)).map((x) => x.id)).toEqual(["v"]);
  });
});
