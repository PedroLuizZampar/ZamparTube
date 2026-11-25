import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../helpers/db";
import { NOW } from "../../helpers/fake-youtube";
import { addToCategory, CH_A, CH_B, insertCategory, insertChannel, insertUser, insertVideo, U } from "../../helpers/fixtures";
import type { Db } from "@/lib/db/client";
import { userChannels } from "@/lib/db/schema";
import { listCategories, setCategoryHiddenFromHome } from "@/lib/queries/channels";
import { listFeed } from "@/lib/queries/videos";

const CH_C = "UCcccccccccccccccccccccc";

let db: Db;
let hidden: number;
let visible: number;

const feed = async (f: { categoryIds?: number[]; channelIds?: string[] } = {}, userId = U) =>
  (await listFeed(db, userId, { now: NOW, limit: 50, ...f })).items.map((v) => v.id).sort();

beforeEach(async () => {
  db = await createTestDb();
  await insertChannel(db, CH_A);
  await insertChannel(db, CH_B);
  await insertChannel(db, CH_C);
  hidden = await insertCategory(db, "Música");
  visible = await insertCategory(db, "Tech");
  await addToCategory(db, CH_A, hidden);
  await addToCategory(db, CH_B, visible);
  await insertVideo(db, "a", { channelId: CH_A });
  await insertVideo(db, "b", { channelId: CH_B });
  await insertVideo(db, "c", { channelId: CH_C });
  await setCategoryHiddenFromHome(db, U, hidden, true);
});

describe("categories hidden from the home feed", () => {
  it("leave the unfiltered home feed", async () => {
    expect(await feed()).toEqual(["b", "c"]);
  });

  it("show when filtering by that category or by the channel", async () => {
    expect(await feed({ categoryIds: [hidden] })).toEqual(["a"]);
    expect(await feed({ categoryIds: [hidden, visible] })).toEqual(["a", "b"]);
    expect(await feed({ channelIds: [CH_A] })).toEqual(["a"]);
    expect(await feed({ channelIds: [CH_A, CH_C] })).toEqual(["a", "c"]);
  });

  it("hidden wins: a channel also in a visible category stays out unless filtered for", async () => {
    await addToCategory(db, CH_A, visible);
    expect(await feed()).toEqual(["b", "c"]);
    expect(await feed({ categoryIds: [visible] })).toEqual(["b"]);
    expect(await feed({ categoryIds: [hidden] })).toEqual(["a"]);
  });

  it("showing the category again brings its channels back", async () => {
    await setCategoryHiddenFromHome(db, U, hidden, false);
    expect(await feed()).toEqual(["a", "b", "c"]);
  });

  it("are listed as hidden", async () => {
    expect((await listCategories(db, U)).map((c) => [c.name, c.hiddenFromHome])).toEqual([
      ["Música", true],
      ["Tech", false],
    ]);
  });

  it("only affect their owner", async () => {
    const other = await insertUser(db, "outra");
    for (const channelId of [CH_A, CH_B, CH_C]) await db.insert(userChannels).values({ userId: other, channelId });
    expect(await feed({}, other)).toEqual(["a", "b", "c"]);
    // Someone else cannot hide (or show) a category that is not theirs.
    await setCategoryHiddenFromHome(db, other, hidden, false);
    expect(await feed()).toEqual(["b", "c"]);
  });
});
