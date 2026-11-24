import { categories, channelCategories, channels, videos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { daysAgo } from "./fake-youtube";

export const CH_A = "UCaaaaaaaaaaaaaaaaaaaaaa";
export const CH_B = "UCbbbbbbbbbbbbbbbbbbbbbb";

export async function insertChannel(db: Db, id: string, extra: Partial<typeof channels.$inferInsert> = {}) {
  await db
    .insert(channels)
    .values({ id, title: `Canal ${id.slice(2, 3)}`, avatarUrl: "a.jpg", uploadsPlaylistId: "UU", ...extra });
}

export async function insertCategory(db: Db, name: string): Promise<number> {
  const [r] = await db.insert(categories).values({ name }).returning({ id: categories.id });
  return r.id;
}

/** A visible, in-feed regular video unless overridden. */
export async function insertVideo(db: Db, id: string, extra: Partial<typeof videos.$inferInsert> = {}) {
  await db.insert(videos).values({
    id,
    channelId: CH_A,
    title: `Vídeo ${id}`,
    description: "",
    publishedAt: daysAgo(1),
    durationSeconds: 600,
    thumbnailUrl: `t-${id}.jpg`,
    embeddable: true,
    shortsCheck: "not_needed",
    liveState: "none",
    inFeed: true,
    ...extra,
  });
}

/** Puts a channel in a category (a channel can be in several). */
export async function addToCategory(db: Db, channelId: string, categoryId: number) {
  await db.insert(channelCategories).values({ channelId, categoryId });
}
