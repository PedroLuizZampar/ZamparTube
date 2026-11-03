import { and, desc, eq, exists, inArray, isNull, ne, not, or, sql } from "drizzle-orm";
import {
  FEED_WINDOW_DAYS,
  MAX_PAGES_PER_RUN,
  MAX_PROBES_PER_RUN,
  MAX_RECHECK_PER_RUN,
  SHORTS_PROBE_ENABLED,
} from "@/lib/constants";
import type { Db } from "@/lib/db/client";
import { channels, playlistItems, videos, watchState } from "@/lib/db/schema";
import { isPlaylistNotFound, isQuotaExceeded, type VideoDetails, type YouTubeClient } from "@/lib/youtube/client";
import { livesPlaylistId, longVideosPlaylistId, uploadsPlaylistId } from "@/lib/youtube/parse";
import type { StoredImage } from "@/lib/youtube/avatar";
import type { ProbeResult } from "@/lib/youtube/shorts-probe";
import { applyProbeResult, classifyVideo } from "./classify";

export interface SyncDeps {
  db: Db;
  yt: YouTubeClient;
  probe: (id: string) => Promise<ProbeResult>;
  now: Date;
  /** Downloads the channel avatar so the app can serve it itself (optional in tests). */
  fetchImage?: (url: string) => Promise<StoredImage | null>;
}

const AVATAR_REFRESH_MS = 7 * 86_400_000;

export interface ChannelSyncResult {
  channelId: string;
  inserted: number;
  removed: number;
  backfillDone: boolean;
}

const PROBE_CONCURRENCY = 4;

/** Pulls new videos for one channel, re-checks pending lives and runs pending Shorts probes. */
export async function syncChannel(deps: SyncDeps, channelId: string): Promise<ChannelSyncResult> {
  const { db, yt, now } = deps;
  const [ch] = await db.select().from(channels).where(eq(channels.id, channelId));
  if (!ch || ch.removedAt) throw new Error(`Canal ${channelId} não encontrado ou removido`);

  const firstImport = ch.lastSyncedAt === null;
  const knownIds = async (ids: string[]) => {
    if (ids.length === 0) return new Set<string>();
    const rows = await db.select({ id: videos.id }).from(videos).where(inArray(videos.id, ids));
    return new Set(rows.map((r) => r.id));
  };

  /** Pages a playlist from `startToken`; stops at a known id unless `stopAtKnown` is false. */
  async function collect(playlistId: string, stopAtKnown: boolean, startToken?: string) {
    const ids: string[] = [];
    let token = startToken;
    for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
      const res = await yt.listPlaylistPage(playlistId, token);
      ids.push(...res.videoIds);
      token = res.nextPageToken;
      if (!token) break;
      if (stopAtKnown && (await knownIds(res.videoIds)).size > 0) return { ids, nextToken: undefined };
    }
    return { ids, nextToken: token };
  }

  // 1. Long videos (UULF, or UU fallback).
  let longPlaylistMissing = ch.longPlaylistMissing;
  const longSource = () => (longPlaylistMissing ? uploadsPlaylistId(channelId) : longVideosPlaylistId(channelId));
  let longResult;
  let switchedToUploads = false;
  try {
    longResult = await collect(longSource(), !firstImport);
  } catch (e) {
    if (longPlaylistMissing || !isPlaylistNotFound(e)) throw e;
    longPlaylistMissing = true;
    switchedToUploads = true;
    await db
      .update(channels)
      .set({ longPlaylistMissing: true, backfillPageToken: null })
      .where(eq(channels.id, channelId));
    longResult = await collect(longSource(), !firstImport);
  }
  // A UULF page token is meaningless on the UU playlist, so a switch drops any pending backfill.
  let backfillPageToken = firstImport
    ? (longResult.nextToken ?? null)
    : switchedToUploads
      ? null
      : ch.backfillPageToken;

  // 2. Lives (UULV). Missing or broken playlist is not an error; quota still is.
  let liveIds: string[] = [];
  try {
    liveIds = (await collect(livesPlaylistId(channelId), !firstImport)).ids;
  } catch (e) {
    if (isQuotaExceeded(e)) throw e;
  }

  // 3. Backfill older history in chunks across runs.
  const backfillIds = new Set<string>();
  if (!firstImport && backfillPageToken) {
    try {
      const res = await collect(longSource(), false, backfillPageToken);
      res.ids.forEach((id) => backfillIds.add(id));
      backfillPageToken = res.nextToken ?? null;
    } catch (e) {
      if (isQuotaExceeded(e)) throw e;
      // An expired or invalid token must not block new videos forever: give up on the rest of the history.
      console.warn(`[sync] backfill do canal ${channelId} abandonado:`, e);
      backfillPageToken = null;
    }
  }

  // 4. Insert videos we have not seen.
  const candidates = [...new Set([...longResult.ids, ...liveIds, ...backfillIds])];
  const known = await knownIds(candidates);
  const newIds = candidates.filter((id) => !known.has(id));
  const details = await yt.getVideos(newIds);
  const feedCutoff = now.getTime() - FEED_WINDOW_DAYS * 86_400_000;
  // A video first seen more than FEED_WINDOW_DAYS after publication is not "new" (first import, backfill,
  // a re-added channel or a lives playlist that failed earlier): it goes to the channel page, not the feed.
  const rows = details.map((d) => ({
    ...videoColumns(d),
    channelId,
    shortsCheckFailures: 0,
    isShort: false,
    inFeed: d.publishedAt.getTime() >= feedCutoff,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(videos).values(rows.slice(i, i + 500)).onConflictDoNothing();
  }

  // 5. Re-check lives that were upcoming or still running, plus videos the user can still reach
  //    (in the feed or in a playlist), so deleted/private ones disappear.
  const newIdSet = new Set(newIds);
  const pendingLives = (
    await db
      .select({ id: videos.id })
      .from(videos)
      .where(and(eq(videos.channelId, channelId), eq(videos.liveState, "pending")))
  )
    .map((r) => r.id)
    .filter((id) => !newIdSet.has(id));
  const reachable = (
    await db
      .select({ id: videos.id })
      .from(videos)
      .leftJoin(watchState, eq(watchState.videoId, videos.id))
      .where(
        and(
          eq(videos.channelId, channelId),
          ne(videos.liveState, "pending"),
          or(
            and(eq(videos.inFeed, true), isNull(videos.dismissedAt), not(sql`coalesce(${watchState.watched}, false)`)),
            exists(db.select({ one: sql`1` }).from(playlistItems).where(eq(playlistItems.videoId, videos.id))),
          ),
        ),
      )
      .orderBy(desc(videos.publishedAt))
      .limit(MAX_RECHECK_PER_RUN)
  )
    .map((r) => r.id)
    .filter((id) => !newIdSet.has(id));
  let removed = 0;
  const recheck = [...pendingLives, ...reachable];
  if (recheck.length > 0) {
    const fresh = await yt.getVideos(recheck);
    const freshIds = new Set(fresh.map((d) => d.id));
    const pendingSet = new Set(pendingLives);
    for (const d of fresh) {
      if (!pendingSet.has(d.id)) continue;
      await db
        .update(videos)
        .set({ ...videoColumns(d), shortsCheckFailures: 0 })
        .where(eq(videos.id, d.id));
    }
    const gone = recheck.filter((id) => !freshIds.has(id));
    if (gone.length > 0) {
      await db.delete(videos).where(inArray(videos.id, gone));
      removed = gone.length;
    }
  }

  // 6. Shorts probe for short-length videos (lives still running are probed once they end).
  if (SHORTS_PROBE_ENABLED) {
    const pending = await db
      .select({ id: videos.id, shortsCheckFailures: videos.shortsCheckFailures })
      .from(videos)
      .where(
        and(eq(videos.channelId, channelId), eq(videos.shortsCheck, "pending"), ne(videos.liveState, "pending")),
      )
      .limit(MAX_PROBES_PER_RUN);
    await forEachConcurrent(pending, PROBE_CONCURRENCY, async (v) => {
      const next = applyProbeResult(v, await deps.probe(v.id));
      await db.update(videos).set(next).where(eq(videos.id, v.id));
    });
  }

  // 7. Avatar: stored once a week; a failed download just retries on the next sync.
  let avatar: { avatarData: string; avatarContentType: string; avatarFetchedAt: Date } | object = {};
  const avatarStale = !ch.avatarFetchedAt || now.getTime() - ch.avatarFetchedAt.getTime() > AVATAR_REFRESH_MS;
  if (deps.fetchImage && avatarStale) {
    const img = await deps.fetchImage(ch.avatarUrl);
    if (img) avatar = { avatarData: img.base64, avatarContentType: img.contentType, avatarFetchedAt: now };
  }

  // 8. Done.
  await db
    .update(channels)
    .set({ lastSyncedAt: now, backfillPageToken, longPlaylistMissing, ...avatar })
    .where(eq(channels.id, channelId));

  return { channelId, inserted: rows.length, removed, backfillDone: backfillPageToken === null };
}

function videoColumns(d: VideoDetails) {
  const c = classifyVideo(d);
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    publishedAt: d.publishedAt,
    durationSeconds: c.durationSeconds,
    thumbnailUrl: d.thumbnailUrl,
    embeddable: d.embeddable,
    shortsCheck: c.shortsCheck,
    liveState: c.liveState,
    isLiveRecording: c.isLiveRecording,
  };
}

async function forEachConcurrent<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}
