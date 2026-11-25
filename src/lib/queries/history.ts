import { and, desc, eq, gt, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { channels, videos, watchState } from "@/lib/db/schema";
import { cardFields, filterCondition, followedBy, toPage, type VideoPage } from "./videos";
import { visibleVideoCondition } from "./visibility";

type HistoryOpts = { limit: number; categoryIds?: number[]; channelIds?: string[] };

/** Visible videos from the user's channels with a watch_state row of theirs matching `where`, last touched first. */
async function historyQuery(db: Db, userId: number, where: SQL, opts: HistoryOpts): Promise<VideoPage> {
  const rows = await db
    .select(cardFields(userId))
    .from(watchState)
    .innerJoin(videos, eq(videos.id, watchState.videoId))
    .innerJoin(channels, eq(channels.id, videos.channelId))
    .where(
      and(eq(watchState.userId, userId), visibleVideoCondition(), followedBy(db, userId), filterCondition(opts), where),
    )
    .orderBy(desc(watchState.updatedAt), videos.id)
    .limit(opts.limit + 1);
  return toPage(rows, opts.limit);
}

/** Started but not finished: "Continuar assistindo". No feed window; dismissed videos included. */
export function listContinueWatching(db: Db, userId: number, opts: HistoryOpts): Promise<VideoPage> {
  return historyQuery(db, userId, and(gt(watchState.positionSeconds, 0), eq(watchState.watched, false))!, opts);
}

/** Watched videos, most recently watched first. */
export function listWatchedHistory(db: Db, userId: number, opts: HistoryOpts): Promise<VideoPage> {
  return historyQuery(db, userId, eq(watchState.watched, true), opts);
}
