import { and, desc, eq, gte, inArray, isNull, not, sql, type SQL } from "drizzle-orm";
import { FEED_WINDOW_DAYS } from "@/lib/constants";
import type { Db } from "@/lib/db/client";
import { channelCategories, channels, playlistItems, playlists, videos, watchState } from "@/lib/db/schema";
import { avatarSrcSql } from "./avatar";
import { visibleVideoCondition } from "./visibility";

export interface VideoCardData {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  channelAvatarSrc: string;
  publishedAt: Date;
  durationSeconds: number;
  thumbnailUrl: string;
  embeddable: boolean;
  isLiveRecording: boolean;
  positionSeconds: number;
  watched: boolean;
  /** In the "Assistir depois" playlist. */
  savedForLater: boolean;
}

export interface VideoPage {
  items: VideoCardData[];
  hasMore: boolean;
}

export const cardFields = {
  id: videos.id,
  title: videos.title,
  channelId: videos.channelId,
  channelTitle: channels.title,
  channelAvatarSrc: avatarSrcSql,
  publishedAt: videos.publishedAt,
  durationSeconds: videos.durationSeconds,
  thumbnailUrl: videos.thumbnailUrl,
  embeddable: videos.embeddable,
  isLiveRecording: videos.isLiveRecording,
  positionSeconds: sql<number>`coalesce(${watchState.positionSeconds}, 0)`.mapWith(Number),
  watched: sql<boolean>`coalesce(${watchState.watched}, false)`.mapWith(Boolean),
  savedForLater: sql<boolean>`exists (select 1 from ${playlistItems} inner join ${playlists} on ${playlists.id} = ${playlistItems.playlistId} where ${playlists.isWatchLater} = true and ${playlistItems.videoId} = ${videos.id})`.mapWith(Boolean),
};

const isWatched = sql`coalesce(${watchState.watched}, false)`;

function cardQuery(db: Db, where: SQL | undefined) {
  return db
    .select(cardFields)
    .from(videos)
    .innerJoin(channels, eq(channels.id, videos.channelId))
    .leftJoin(watchState, eq(watchState.videoId, videos.id))
    .where(and(visibleVideoCondition(), where));
}

export function toPage(rows: VideoCardData[], limit: number): VideoPage {
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

/** Category/channel filters shared by the feed and the history. Categories OR'd, channels OR'd, lists AND'd. */
export function filterCondition(f: { categoryIds?: number[]; channelIds?: string[] }): SQL | undefined {
  return and(
    // A channel matches when it is in any selected category.
    f.categoryIds?.length
      ? inArray(
          videos.channelId,
          sql`(select ${channelCategories.channelId} from ${channelCategories} where ${inArray(channelCategories.categoryId, f.categoryIds)})`,
        )
      : undefined,
    f.channelIds?.length ? inArray(videos.channelId, f.channelIds) : undefined,
  );
}

/**
 * New, unwatched, undismissed videos from active channels published in the last FEED_WINDOW_DAYS.
 * Categories are OR'd, channels are OR'd, and the two lists are AND'd; an empty list means no filter.
 * The feed ends when this is empty.
 */
export async function listFeed(
  db: Db,
  opts: { categoryIds?: number[]; channelIds?: string[]; limit: number; now?: Date },
): Promise<VideoPage> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - FEED_WINDOW_DAYS * 86_400_000);
  const rows = await cardQuery(
    db,
    and(
      eq(videos.inFeed, true),
      isNull(videos.dismissedAt),
      not(isWatched),
      isNull(channels.removedAt),
      gte(videos.publishedAt, since),
      filterCondition(opts),
    ),
  )
    .orderBy(desc(videos.publishedAt), videos.id)
    .limit(opts.limit + 1);
  return toPage(rows, opts.limit);
}

/** Every visible video of one channel, newest first, watched ones included. */
export async function listChannelVideos(db: Db, channelId: string, opts: { limit: number }): Promise<VideoPage> {
  const rows = await cardQuery(db, eq(videos.channelId, channelId))
    .orderBy(desc(videos.publishedAt), videos.id)
    .limit(opts.limit + 1);
  return toPage(rows, opts.limit);
}

/** Full-text search (Portuguese) over title and description of visible videos from active channels. */
export async function searchVideos(db: Db, q: string, opts: { limit: number }): Promise<VideoPage> {
  const query = q.trim();
  if (!query) return { items: [], hasMore: false };
  const tsQuery = sql`websearch_to_tsquery('portuguese', ${query})`;
  const rows = await cardQuery(db, and(isNull(channels.removedAt), sql`${videos.searchVector} @@ ${tsQuery}`))
    .orderBy(sql`ts_rank(${videos.searchVector}, ${tsQuery}) desc`, desc(videos.publishedAt))
    .limit(opts.limit + 1);
  return toPage(rows, opts.limit);
}

/** A single video for the watch page, or null if it must not be shown. */
export async function getVisibleVideo(
  db: Db,
  id: string,
): Promise<(VideoCardData & { description: string }) | null> {
  const [row] = await db
    .select({ ...cardFields, description: videos.description })
    .from(videos)
    .innerJoin(channels, eq(channels.id, videos.channelId))
    .leftJoin(watchState, eq(watchState.videoId, videos.id))
    .where(and(visibleVideoCondition(), eq(videos.id, id)));
  return row ?? null;
}
