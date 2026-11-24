import { and, desc, eq, gt, isNull, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { channels, videos, watchState } from "@/lib/db/schema";
import { cardFields, filterCondition, toPage, type VideoPage } from "./videos";
import { visibleVideoCondition } from "./visibility";

type HistoryOpts = { limit: number; categoryIds?: number[]; channelIds?: string[] };

/** Visible videos from active channels that have a watch_state row matching `where`, last touched first. */
async function historyQuery(db: Db, where: SQL, opts: HistoryOpts): Promise<VideoPage> {
  const rows = await db
    .select(cardFields)
    .from(watchState)
    .innerJoin(videos, eq(videos.id, watchState.videoId))
    .innerJoin(channels, eq(channels.id, videos.channelId))
    .where(and(visibleVideoCondition(), isNull(channels.removedAt), filterCondition(opts), where))
    .orderBy(desc(watchState.updatedAt), videos.id)
    .limit(opts.limit + 1);
  return toPage(rows, opts.limit);
}

/** Started but not finished: "Continuar assistindo". No feed window; dismissed videos included. */
export function listContinueWatching(db: Db, opts: HistoryOpts): Promise<VideoPage> {
  return historyQuery(db, and(gt(watchState.positionSeconds, 0), eq(watchState.watched, false))!, opts);
}

/** Watched videos, most recently watched first. */
export function listWatchedHistory(db: Db, opts: HistoryOpts): Promise<VideoPage> {
  return historyQuery(db, eq(watchState.watched, true), opts);
}
