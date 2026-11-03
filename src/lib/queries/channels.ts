import { asc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { categories, channels } from "@/lib/db/schema";
import type { ChannelInfo } from "@/lib/youtube/client";
import { uploadsPlaylistId } from "@/lib/youtube/parse";

export interface ChannelListItem {
  id: string;
  title: string;
  handle: string | null;
  avatarUrl: string;
  categoryId: number | null;
  lastSyncedAt: Date | null;
}

/** Active (not removed) channels, alphabetical. */
export async function listChannels(db: Db): Promise<ChannelListItem[]> {
  return db
    .select({
      id: channels.id,
      title: channels.title,
      handle: channels.handle,
      avatarUrl: channels.avatarUrl,
      categoryId: channels.categoryId,
      lastSyncedAt: channels.lastSyncedAt,
    })
    .from(channels)
    .where(isNull(channels.removedAt))
    .orderBy(sql`lower(${channels.title})`);
}

export async function getChannel(db: Db, id: string): Promise<ChannelListItem | null> {
  const [row] = await db
    .select({
      id: channels.id,
      title: channels.title,
      handle: channels.handle,
      avatarUrl: channels.avatarUrl,
      categoryId: channels.categoryId,
      lastSyncedAt: channels.lastSyncedAt,
    })
    .from(channels)
    .where(eq(channels.id, id));
  return row ?? null;
}

/** Adds a channel, or reactivates a removed one with fresh title/avatar. */
export async function upsertChannel(db: Db, info: ChannelInfo): Promise<void> {
  await db
    .insert(channels)
    .values({
      id: info.id,
      title: info.title,
      handle: info.handle,
      avatarUrl: info.avatarUrl,
      uploadsPlaylistId: uploadsPlaylistId(info.id),
    })
    .onConflictDoUpdate({
      target: channels.id,
      set: { title: info.title, handle: info.handle, avatarUrl: info.avatarUrl, removedAt: null },
    });
}

/** Soft delete: videos leave the feed and search, but stay available to playlists. */
export async function removeChannel(db: Db, id: string): Promise<void> {
  await db.update(channels).set({ removedAt: new Date() }).where(eq(channels.id, id));
}

export async function setChannelCategory(db: Db, id: string, categoryId: number | null): Promise<void> {
  await db.update(channels).set({ categoryId }).where(eq(channels.id, id));
}

export async function listCategories(db: Db): Promise<Array<{ id: number; name: string }>> {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.position), asc(categories.id));
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("O nome não pode ficar vazio");
  return trimmed.slice(0, 60);
}

export async function createCategory(db: Db, name: string): Promise<number> {
  const [row] = await db
    .insert(categories)
    .values({ name: cleanName(name) })
    .returning({ id: categories.id });
  return row.id;
}

export async function renameCategory(db: Db, id: number, name: string): Promise<void> {
  await db.update(categories).set({ name: cleanName(name) }).where(eq(categories.id, id));
}

/** Channels in this category become uncategorized (FK on delete set null). */
export async function deleteCategory(db: Db, id: number): Promise<void> {
  await db.delete(categories).where(eq(categories.id, id));
}
