import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { categories, channelCategories, channels } from "@/lib/db/schema";
import type { ChannelInfo } from "@/lib/youtube/client";
import { uploadsPlaylistId } from "@/lib/youtube/parse";
import { avatarSrcSql } from "./avatar";
import { imageSrcSql } from "./images";

export interface ChannelListItem {
  id: string;
  title: string;
  handle: string | null;
  avatarUrl: string;
  /** Local URL of the stored avatar, or "" when not downloaded yet. */
  avatarSrc: string;
  /** Categories this channel is in (a channel can be in several), ascending. */
  categoryIds: number[];
  lastSyncedAt: Date | null;
}

// Qualified by hand: Drizzle prints single-table columns unqualified, which would bind to the subquery's own table.
const categoryIdsSql = sql<number[]>`coalesce((select array_agg(cc.category_id order by cc.category_id)
  from ${channelCategories} as cc where cc.channel_id = ${sql.raw('"channels"."id"')}), '{}')`.mapWith(
  (v: unknown) => (Array.isArray(v) ? v.map(Number) : parsePgIntArray(String(v ?? "{}"))),
);

/** Some drivers return int[] as text ("{1,2}"). */
function parsePgIntArray(text: string): number[] {
  const inner = text.replace(/^{|}$/g, "");
  return inner ? inner.split(",").map(Number) : [];
}

/** Active (not removed) channels, alphabetical. */
export async function listChannels(db: Db): Promise<ChannelListItem[]> {
  return db
    .select({
      id: channels.id,
      title: channels.title,
      handle: channels.handle,
      avatarUrl: channels.avatarUrl,
      avatarSrc: avatarSrcSql,
      categoryIds: categoryIdsSql,
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
      avatarSrc: avatarSrcSql,
      categoryIds: categoryIdsSql,
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

/** Adds the channel to a category (on) or takes it out (off). Adding twice is harmless. */
export async function setChannelInCategory(db: Db, channelId: string, categoryId: number, on: boolean): Promise<void> {
  if (on) {
    await db.insert(channelCategories).values({ channelId, categoryId }).onConflictDoNothing();
  } else {
    await db
      .delete(channelCategories)
      .where(and(eq(channelCategories.channelId, channelId), eq(channelCategories.categoryId, categoryId)));
  }
}

export interface CategoryItem {
  id: number;
  name: string;
  /** Local URL of the uploaded picture, or "". */
  imageSrc: string;
  /** Active (not removed) channels in this category. */
  channelCount: number;
}

export async function listCategories(db: Db): Promise<CategoryItem[]> {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      imageSrc: imageSrcSql("category"),
      // Qualified by hand: Drizzle prints single-table columns unqualified, and "id" would bind to channels.id here.
      channelCount: sql<number>`(select count(*) from ${channelCategories} as cc
        join ${channels} as ch on ch.id = cc.channel_id
        where cc.category_id = ${sql.raw('"categories"."id"')} and ch.removed_at is null)`.mapWith(Number),
    })
    .from(categories)
    .orderBy(asc(categories.position), asc(categories.id));
}

/** Thrown when another category already uses the name (case-insensitive). */
export class CategoryNameTakenError extends Error {
  constructor() {
    super("Já existe uma categoria com esse nome.");
    this.name = "CategoryNameTakenError";
  }
}

const DEFAULT_CATEGORY_NAME = "Nova categoria";

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("O nome não pode ficar vazio");
  return trimmed.slice(0, 60);
}

async function categoryNameTaken(db: Db, name: string, exceptId?: number): Promise<boolean> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        sql`lower(${categories.name}) = lower(${name})`,
        exceptId === undefined ? undefined : ne(categories.id, exceptId),
      ),
    )
    .limit(1);
  return !!row;
}

/** Creates a category; without a name it picks a free "Nova categoria" name. Names are unique ignoring case. */
export async function createCategory(db: Db, name?: string): Promise<number> {
  let clean = name === undefined ? DEFAULT_CATEGORY_NAME : cleanName(name);
  if (name === undefined) {
    for (let n = 2; await categoryNameTaken(db, clean); n++) clean = `${DEFAULT_CATEGORY_NAME} ${n}`;
  } else if (await categoryNameTaken(db, clean)) {
    throw new CategoryNameTakenError();
  }
  try {
    const [row] = await db.insert(categories).values({ name: clean }).returning({ id: categories.id });
    return row.id;
  } catch (e) {
    throw isUniqueViolation(e) ? new CategoryNameTakenError() : e;
  }
}

/** Renames a category; a case change of its own name is allowed. */
export async function renameCategory(db: Db, id: number, name: string): Promise<void> {
  const clean = cleanName(name);
  if (await categoryNameTaken(db, clean, id)) throw new CategoryNameTakenError();
  try {
    await db.update(categories).set({ name: clean }).where(eq(categories.id, id));
  } catch (e) {
    throw isUniqueViolation(e) ? new CategoryNameTakenError() : e;
  }
}

/** Channels lose this category (their channel_categories rows cascade); the channels stay. */
export async function deleteCategory(db: Db, id: number): Promise<void> {
  await db.delete(categories).where(eq(categories.id, id));
}
