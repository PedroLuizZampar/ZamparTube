import { and, desc, eq, isNull, not, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { channels, videos, watchState } from "@/lib/db/schema";
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

function toPage(rows: VideoCardData[], limit: number): VideoPage {
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

/** New, unwatched, undismissed videos from active channels. The feed ends when this is empty. */
export async function listFeed(db: Db, opts: { categoryId?: number; limit: number }): Promise<VideoPage> {
  const rows = await cardQuery(
    db,
    and(
      eq(videos.inFeed, true),
      isNull(videos.dismissedAt),
      not(isWatched),
      isNull(channels.removedAt),
      opts.categoryId !== undefined ? eq(channels.categoryId, opts.categoryId) : undefined,
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
