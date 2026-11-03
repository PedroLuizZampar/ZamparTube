import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "../../helpers/db";
import { channels, playlists, videos } from "@/lib/db/schema";

describe("schema", () => {
  // Build the migrated template up front (hook timeout), not inside the first test.
  beforeAll(async () => {
    await createTestDb();
  });

  it("migrates and seeds exactly one watch-later playlist", async () => {
    const db = await createTestDb();
    const rows = await db.select().from(playlists);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Assistir depois", isWatchLater: true });
  });

  it("rejects a second watch-later playlist", async () => {
    const db = await createTestDb();
    await expect(db.insert(playlists).values({ name: "Outra", isWatchLater: true })).rejects.toThrow();
  });

  it("search_vector matches portuguese stems", async () => {
    const db = await createTestDb();
    await db.insert(channels).values({
      id: "UCaaaaaaaaaaaaaaaaaaaaaa",
      title: "Canal",
      avatarUrl: "",
      uploadsPlaylistId: "UUaaaaaaaaaaaaaaaaaaaaaa",
    });
    await db.insert(videos).values({
      id: "vid1",
      channelId: "UCaaaaaaaaaaaaaaaaaaaaaa",
      title: "Aprendendo programação funcional",
      description: "Um vídeo sobre linguagens",
      publishedAt: new Date("2026-01-01T00:00:00Z"),
      durationSeconds: 600,
      thumbnailUrl: "",
      embeddable: true,
      shortsCheck: "not_needed",
      liveState: "none",
      inFeed: true,
    });
    const r = await db.execute(
      sql`select id from videos where search_vector @@ websearch_to_tsquery('portuguese', 'programação')`,
    );
    expect((r as { rows: unknown[] }).rows).toHaveLength(1);
    const r2 = await db.execute(
      sql`select id from videos where search_vector @@ websearch_to_tsquery('portuguese', 'programar')`,
    );
    expect((r2 as { rows: unknown[] }).rows).toHaveLength(1);
  });
});
