import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { channels, queueItems, videos, watchState } from "@/lib/db/schema";
import { cardFields, type VideoCardData } from "./videos";
import { visibleVideoCondition } from "./visibility";

/*
 * The queue is a list that only changes when the viewer changes it: playing a video never takes it out.
 * `played_at` records when each video last started playing; the latest one is the cursor ("where it stopped").
 */

/** Every queued id (hidden channels included), in queue order. */
async function allIds(db: Db): Promise<string[]> {
  const rows = await db.select({ id: queueItems.videoId }).from(queueItems).orderBy(asc(queueItems.position));
  return rows.map((r) => r.id);
}

/** Queued ids the viewer can see, in queue order. */
async function visibleIds(db: Db): Promise<string[]> {
  const rows = await db
    .select({ id: queueItems.videoId })
    .from(queueItems)
    .innerJoin(videos, eq(videos.id, queueItems.videoId))
    .where(visibleVideoCondition())
    .orderBy(asc(queueItems.position));
  return rows.map((r) => r.id);
}

/** Saves `order` as positions 1..n, adding the ids that are not queued yet (their play time is kept otherwise). */
async function writeOrder(db: Db, order: string[]): Promise<void> {
  if (order.length === 0) return;
  await db
    .insert(queueItems)
    .values(order.map((videoId, i) => ({ videoId, position: i + 1 })))
    .onConflictDoUpdate({ target: queueItems.videoId, set: { position: sql`excluded.position` } });
}

/** The visible video that started playing last, or null when nothing in the queue was played. */
export async function queueCursor(db: Db): Promise<string | null> {
  const [row] = await db
    .select({ id: queueItems.videoId })
    .from(queueItems)
    .innerJoin(videos, eq(videos.id, queueItems.videoId))
    .where(and(isNotNull(queueItems.playedAt), visibleVideoCondition()))
    .orderBy(desc(queueItems.playedAt))
    .limit(1);
  return row?.id ?? null;
}

/** "Continuar de onde parou": the cursor, or the first video when nothing was played yet. */
export async function queueResumeId(db: Db): Promise<string | null> {
  return (await queueCursor(db)) ?? (await visibleIds(db))[0] ?? null;
}

/**
 * Adds videos to the queue: "end" after the last one, "next" right after the video that played last (or at the
 * front when nothing was played). A video already in the queue is moved instead of duplicated.
 */
export async function enqueue(db: Db, videoIds: string[], mode: "end" | "next"): Promise<void> {
  const unique = [...new Set(videoIds)];
  if (unique.length === 0) return;
  const rest = (await allIds(db)).filter((id) => !unique.includes(id));
  let at = rest.length;
  if (mode === "next") {
    const cursor = await queueCursor(db);
    at = cursor && rest.includes(cursor) ? rest.indexOf(cursor) + 1 : 0;
  }
  await writeOrder(db, [...rest.slice(0, at), ...unique, ...rest.slice(at)]);
}

export async function removeFromQueue(db: Db, videoId: string): Promise<void> {
  await db.delete(queueItems).where(eq(queueItems.videoId, videoId));
}

export async function clearQueue(db: Db): Promise<void> {
  await db.delete(queueItems);
}

export async function replaceQueue(db: Db, videoIds: string[]): Promise<void> {
  await clearQueue(db);
  await enqueue(db, videoIds, "end");
}

/** Moves a video to `toIndex` among the visible queued videos (clamped), renumbering them. */
export async function moveInQueue(db: Db, videoId: string, toIndex: number): Promise<void> {
  const order = await visibleIds(db);
  const from = order.indexOf(videoId);
  if (from === -1) return;
  order.splice(from, 1);
  order.splice(Math.max(0, Math.min(toIndex, order.length)), 0, videoId);
  await db
    .update(queueItems)
    .set({
      position: sql`(case ${queueItems.videoId} ${sql.join(
        order.map((id, i) => sql`when ${id} then ${i + 1}::int`),
        sql` `,
      )} end)`,
    })
    .where(inArray(queueItems.videoId, order));
}

/** The video started playing: if it is queued, it becomes the cursor. It stays in the queue. */
export async function markPlaying(db: Db, videoId: string): Promise<void> {
  await db.update(queueItems).set({ playedAt: sql`clock_timestamp()` }).where(eq(queueItems.videoId, videoId));
}

/**
 * Where ⏮ and ⏭ lead when following the queue: its neighbours for a queued video; for any other video, ⏭ goes
 * back to where the queue stopped.
 */
export async function queueNeighbors(db: Db, currentId: string): Promise<{ prev: string | null; next: string | null }> {
  const order = await visibleIds(db);
  const i = order.indexOf(currentId);
  if (i === -1) return { prev: null, next: await queueResumeId(db) };
  return { prev: order[i - 1] ?? null, next: order[i + 1] ?? null };
}

/** Visible queued videos, in order. */
export async function listQueue(db: Db): Promise<VideoCardData[]> {
  return db
    .select(cardFields)
    .from(queueItems)
    .innerJoin(videos, eq(videos.id, queueItems.videoId))
    .innerJoin(channels, eq(channels.id, videos.channelId))
    .leftJoin(watchState, eq(watchState.videoId, videos.id))
    .where(visibleVideoCondition())
    .orderBy(asc(queueItems.position));
}

export async function queueCount(db: Db): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(queueItems)
    .innerJoin(videos, eq(videos.id, queueItems.videoId))
    .where(visibleVideoCondition());
  return row?.n ?? 0;
}
