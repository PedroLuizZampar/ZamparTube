import { and, asc, eq, ne, notExists, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { categories, channelCategories, channels, userChannels } from "@/lib/db/schema";
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
  /** The user's categories this channel is in (a channel can be in several), ascending. */
  categoryIds: number[];
  lastSyncedAt: Date | null;
}

// Qualified by hand: Drizzle prints single-table columns unqualified, which would bind to the subquery's own table.
const categoryIdsSql = (userId: number) =>
  sql<number[]>`coalesce((select array_agg(cc.category_id order by cc.category_id)
    from ${channelCategories} as cc join ${categories} as cat on cat.id = cc.category_id
    where cc.channel_id = ${sql.raw('"channels"."id"')} and cat.user_id = ${userId}), '{}')`.mapWith((v: unknown) =>
    Array.isArray(v) ? v.map(Number) : parsePgIntArray(String(v ?? "{}")),
  );

/** Some drivers return int[] as text ("{1,2}"). */
function parsePgIntArray(text: string): number[] {
  const inner = text.replace(/^{|}$/g, "");
  return inner ? inner.split(",").map(Number) : [];
}

const channelFields = (userId: number) => ({
  id: channels.id,
  title: channels.title,
  handle: channels.handle,
  avatarUrl: channels.avatarUrl,
  avatarSrc: avatarSrcSql,
  categoryIds: categoryIdsSql(userId),
  lastSyncedAt: channels.lastSyncedAt,
});

/** The channels the user follows, alphabetical. */
export async function listChannels(db: Db, userId: number): Promise<ChannelListItem[]> {
  return db
    .select(channelFields(userId))
    .from(channels)
    .innerJoin(userChannels, and(eq(userChannels.channelId, channels.id), eq(userChannels.userId, userId)))
    .orderBy(sql`lower(${channels.title})`);
}

/** Any known channel (a playlist can hold videos of a channel the user does not follow), with the user's categories. */
export async function getChannel(db: Db, userId: number, id: string): Promise<ChannelListItem | null> {
  const [row] = await db.select(channelFields(userId)).from(channels).where(eq(channels.id, id));
  return row ?? null;
}

/** Adds a channel to the shared catalog, or refreshes title/avatar and reactivates it for syncing. */
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

/** The user starts following a channel already in the catalog. Following twice is harmless. */
export async function followChannel(db: Db, userId: number, channelId: string): Promise<void> {
  await db.insert(userChannels).values({ userId, channelId }).onConflictDoNothing();
  await db.update(channels).set({ removedAt: null }).where(eq(channels.id, channelId));
}

/**
 * The user stops following: the channel's videos leave their feed and search, but stay available to their playlists.
 * Its categories are kept, so following it again brings them back. When nobody follows it anymore, syncing stops.
 */
export async function removeChannel(db: Db, userId: number, id: string): Promise<void> {
  await db.delete(userChannels).where(and(eq(userChannels.userId, userId), eq(userChannels.channelId, id)));
  await db
    .update(channels)
    .set({ removedAt: new Date() })
    .where(
      and(
        eq(channels.id, id),
        notExists(db.select({ one: sql`1` }).from(userChannels).where(eq(userChannels.channelId, id))),
      ),
    );
}

/** True when the category exists and belongs to the user. */
async function ownsCategory(db: Db, userId: number, categoryId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  return !!row;
}

/** Adds the channel to one of the user's categories (on) or takes it out (off). Adding twice is harmless. */
export async function setChannelInCategory(
  db: Db,
  userId: number,
  channelId: string,
  categoryId: number,
  on: boolean,
): Promise<void> {
  if (!(await ownsCategory(db, userId, categoryId))) return;
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
  /** Channels the user follows in this category. */
  channelCount: number;
  /** Its channels only show on the home feed when filtered for. */
  hiddenFromHome: boolean;
}

export async function listCategories(db: Db, userId: number): Promise<CategoryItem[]> {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      imageSrc: imageSrcSql("category"),
      hiddenFromHome: categories.hiddenFromHome,
      // Qualified by hand: Drizzle prints single-table columns unqualified, and "id" would bind to another table here.
      channelCount: sql<number>`(select count(*) from ${channelCategories} as cc
        join ${userChannels} as uc on uc.channel_id = cc.channel_id and uc.user_id = ${userId}
        where cc.category_id = ${sql.raw('"categories"."id"')})`.mapWith(Number),
    })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.position), asc(categories.id));
}

/** Thrown when another category of the user already uses the name (case-insensitive). */
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

async function categoryNameTaken(db: Db, userId: number, name: string, exceptId?: number): Promise<boolean> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        sql`lower(${categories.name}) = lower(${name})`,
        exceptId === undefined ? undefined : ne(categories.id, exceptId),
      ),
    )
    .limit(1);
  return !!row;
}

/** Creates a category; without a name it picks a free "Nova categoria" name. Names are unique per user ignoring case. */
export async function createCategory(db: Db, userId: number, name?: string): Promise<number> {
  let clean = name === undefined ? DEFAULT_CATEGORY_NAME : cleanName(name);
  if (name === undefined) {
    for (let n = 2; await categoryNameTaken(db, userId, clean); n++) clean = `${DEFAULT_CATEGORY_NAME} ${n}`;
  } else if (await categoryNameTaken(db, userId, clean)) {
    throw new CategoryNameTakenError();
  }
  try {
    const [row] = await db.insert(categories).values({ userId, name: clean }).returning({ id: categories.id });
    return row.id;
  } catch (e) {
    throw isUniqueViolation(e) ? new CategoryNameTakenError() : e;
  }
}

/** Renames one of the user's categories; a case change of its own name is allowed. */
export async function renameCategory(db: Db, userId: number, id: number, name: string): Promise<void> {
  const clean = cleanName(name);
  if (await categoryNameTaken(db, userId, clean, id)) throw new CategoryNameTakenError();
  try {
    await db
      .update(categories)
      .set({ name: clean })
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  } catch (e) {
    throw isUniqueViolation(e) ? new CategoryNameTakenError() : e;
  }
}

/** Hides the category's channels from the home feed (they still show when filtered for), or shows them again. */
export async function setCategoryHiddenFromHome(db: Db, userId: number, id: number, hidden: boolean): Promise<void> {
  await db
    .update(categories)
    .set({ hiddenFromHome: hidden })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
}

/** Channels lose this category (their channel_categories rows cascade); the channels stay. */
export async function deleteCategory(db: Db, userId: number, id: number): Promise<void> {
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
}

