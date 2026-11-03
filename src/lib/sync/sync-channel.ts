import { and, eq, inArray, ne } from "drizzle-orm";
import {
  FEED_WINDOW_DAYS,
  MAX_PAGES_PER_RUN,
  MAX_PROBES_PER_RUN,
  SHORTS_PROBE_ENABLED,
} from "@/lib/constants";
import type { Db } from "@/lib/db/client";
import { channels, videos } from "@/lib/db/schema";
import { isPlaylistNotFound, isQuotaExceeded, type VideoDetails, type YouTubeClient } from "@/lib/youtube/client";
import { livesPlaylistId, longVideosPlaylistId, uploadsPlaylistId } from "@/lib/youtube/parse";
import type { ProbeResult } from "@/lib/youtube/shorts-probe";
import { applyProbeResult, classifyVideo } from "./classify";

export interface SyncDeps {
  db: Db;
  yt: YouTubeClient;
  probe: (id: string) => Promise<ProbeResult>;
  now: Date;
}

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
  try {
    longResult = await collect(longSource(), !firstImport);
  } catch (e) {
    if (longPlaylistMissing || !isPlaylistNotFound(e)) throw e;
    longPlaylistMissing = true;
    await db.update(channels).set({ longPlaylistMissing: true }).where(eq(channels.id, channelId));
    longResult = await collect(longSource(), !firstImport);
  }
  let backfillPageToken = firstImport ? (longResult.nextToken ?? null) : ch.backfillPageToken;

  // 2. Lives (UULV). Missing or broken playlist is not an error; quota still is.
  let liveIds: string[] = [];
  try {
    liveIds = (await collect(livesPlaylistId(channelId), !firstImport)).ids;
  } catch (e) {
    if (isQuotaExceeded(e)) throw e;
  }

  // 3. Backfill older history in chunks across runs.
  const backfillIds = new Set<string>();
  if (!firstImport && ch.backfillPageToken) {
    const res = await collect(longSource(), false, ch.backfillPageToken);
    res.ids.forEach((id) => backfillIds.add(id));
    backfillPageToken = res.nextToken ?? null;
  }

  // 4. Insert videos we have not seen.
  const candidates = [...new Set([...longResult.ids, ...liveIds, ...backfillIds])];
  const known = await knownIds(candidates);
  const newIds = candidates.filter((id) => !known.has(id));
  const details = await yt.getVideos(newIds);
  const feedCutoff = now.getTime() - FEED_WINDOW_DAYS * 86_400_000;
  const rows = details.map((d) => {
    const windowed = firstImport || backfillIds.has(d.id);
    return {
      ...videoColumns(d),
      channelId,
      shortsCheckFailures: 0,
      isShort: false,
      inFeed: windowed ? d.publishedAt.getTime() >= feedCutoff : true,
    };
  });
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(videos).values(rows.slice(i, i + 500)).onConflictDoNothing();
  }

  // 5. Re-check lives that were upcoming or still running.
  const newIdSet = new Set(newIds);
  const pendingLives = (
    await db
      .select({ id: videos.id })
      .from(videos)
      .where(and(eq(videos.channelId, channelId), eq(videos.liveState, "pending")))
  )
    .map((r) => r.id)
    .filter((id) => !newIdSet.has(id));
  let removed = 0;
  if (pendingLives.length > 0) {
    const fresh = await yt.getVideos(pendingLives);
    const freshIds = new Set(fresh.map((d) => d.id));
    for (const d of fresh) {
      await db
        .update(videos)
        .set({ ...videoColumns(d), shortsCheckFailures: 0 })
        .where(eq(videos.id, d.id));
    }
    const gone = pendingLives.filter((id) => !freshIds.has(id));
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

  // 7. Done.
  await db
    .update(channels)
    .set({ lastSyncedAt: now, backfillPageToken, longPlaylistMissing })
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
