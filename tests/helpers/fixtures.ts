import { and, eq } from "drizzle-orm";
import { categories, channelCategories, channels, userChannels, users, videos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { daysAgo } from "./fake-youtube";

export const CH_A = "UCaaaaaaaaaaaaaaaaaaaaaa";
export const CH_B = "UCbbbbbbbbbbbbbbbbbbbbbb";

/** The test user: the placeholder owner every migrated database starts with (id 1). */
export const U = 1;

/** Another account, for checks that one user never sees another's data. */
export async function insertUser(db: Db, username: string): Promise<number> {
  const [r] = await db.insert(users).values({ username, passwordHash: "x" }).returning({ id: users.id });
  return r.id;
}

/** A channel in the catalog, followed by `followedBy` (the test user unless given; [] for nobody). */
export async function insertChannel(
  db: Db,
  id: string,
  extra: Partial<typeof channels.$inferInsert> = {},
  followedBy: number[] = [U],
) {
  await db
    .insert(channels)
    .values({ id, title: `Canal ${id.slice(2, 3)}`, avatarUrl: "a.jpg", uploadsPlaylistId: "UU", ...extra });
  for (const userId of followedBy) await db.insert(userChannels).values({ userId, channelId: id });
}

/** The user stops following the channel (its videos leave their feed, search and history). */
export async function unfollow(db: Db, channelId: string, userId = U) {
  await db.delete(userChannels).where(and(eq(userChannels.userId, userId), eq(userChannels.channelId, channelId)));
}

export async function insertCategory(db: Db, name: string, userId = U): Promise<number> {
  const [r] = await db.insert(categories).values({ userId, name }).returning({ id: categories.id });
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
