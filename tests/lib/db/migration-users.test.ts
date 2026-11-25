import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { listCategories, listChannels } from "@/lib/queries/channels";
import { listWatchedHistory } from "@/lib/queries/history";
import { getWatchLaterId, listPlaylistVideos } from "@/lib/queries/playlists";
import { listQueue } from "@/lib/queries/queue";
import { createUser } from "@/lib/queries/users";
import { listFeed } from "@/lib/queries/videos";

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A copy of the migrations folder holding only the first `count` migrations. */
function migrationsUpTo(count: number): string {
  const dir = mkdtempSync(join(tmpdir(), "zt-mig-"));
  dirs.push(dir);
  cpSync("drizzle", dir, { recursive: true });
  const journalPath = join(dir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  journal.entries = journal.entries.slice(0, count);
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

describe("migration 0007 (accounts)", () => {
  it("gives everything that existed before to the first account created", async () => {
    const client = new PGlite();
    const raw = drizzle(client);
    await migrate(raw, { migrationsFolder: migrationsUpTo(7) });

    // Data as the single-user app stored it (0001 already seeded "Assistir depois" as playlist 1).
    await client.exec(`
      insert into channels (id, title, avatar_url, uploads_playlist_id) values
        ('UCaaaaaaaaaaaaaaaaaaaaaa', 'Canal A', '', 'UUa'),
        ('UCbbbbbbbbbbbbbbbbbbbbbb', 'Canal B', '', 'UUb');
      update channels set removed_at = now() where id = 'UCbbbbbbbbbbbbbbbbbbbbbb';
      insert into videos (id, channel_id, title, published_at, duration_seconds, thumbnail_url, shorts_check, live_state, in_feed, dismissed_at) values
        ('v1', 'UCaaaaaaaaaaaaaaaaaaaaaa', 'Um', now() - interval '1 day', 600, 't', 'not_needed', 'none', true, null),
        ('v2', 'UCaaaaaaaaaaaaaaaaaaaaaa', 'Dois', now() - interval '2 days', 600, 't', 'not_needed', 'none', true, now()),
        ('v3', 'UCaaaaaaaaaaaaaaaaaaaaaa', 'Três', now() - interval '3 days', 600, 't', 'not_needed', 'none', true, null);
      insert into categories (name) values ('Tech');
      insert into channel_categories (channel_id, category_id) values ('UCaaaaaaaaaaaaaaaaaaaaaa', 1);
      insert into watch_state (video_id, position_seconds, watched) values ('v3', 590, true);
      insert into playlist_items (playlist_id, video_id, position) values (1, 'v1', 0);
      insert into queue_items (video_id, position) values ('v1', 1);
    `);

    await migrate(raw, { migrationsFolder: "drizzle" });
    const db = drizzle(client, { schema }) as unknown as Db;
    const owner = await createUser(db, "pedro", "hash");

    expect((await listChannels(db, owner)).map((c) => [c.title, c.categoryIds])).toEqual([["Canal A", [1]]]);
    expect((await listCategories(db, owner)).map((c) => [c.name, c.hiddenFromHome])).toEqual([["Tech", false]]);
    // v2 stays dismissed, v3 stays watched: only v1 is new.
    expect((await listFeed(db, owner, { limit: 10 })).items.map((v) => v.id)).toEqual(["v1"]);
    expect((await listWatchedHistory(db, owner, { limit: 10 })).items.map((v) => v.id)).toEqual(["v3"]);
    expect(await getWatchLaterId(db, owner)).toBe(1);
    expect((await listPlaylistVideos(db, owner, 1)).map((v) => v.id)).toEqual(["v1"]);
    expect((await listQueue(db, owner)).map((v) => v.id)).toEqual(["v1"]);

    const other = await createUser(db, "ana", "hash");
    expect(await listChannels(db, other)).toEqual([]);
    expect((await listFeed(db, other, { limit: 10 })).items).toEqual([]);
  }, 60_000);
});
