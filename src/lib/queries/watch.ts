import { eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { videos, watchState } from "@/lib/db/schema";
import { shouldMarkWatched } from "@/lib/player/progress";

/** Saves the playback position; marks watched at 90% and never un-marks. */
export async function saveProgress(
  db: Db,
  videoId: string,
  positionSeconds: number,
  durationSeconds: number,
): Promise<{ watched: boolean }> {
  const position = Math.max(0, Math.floor(positionSeconds));
  const reached = shouldMarkWatched(positionSeconds, durationSeconds);
  const [row] = await db
    .insert(watchState)
    .values({ videoId, positionSeconds: position, watched: reached, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: watchState.videoId,
      set: {
        positionSeconds: position,
        watched: sql`${watchState.watched} or excluded.watched`,
        updatedAt: new Date(),
      },
    })
    .returning({ watched: watchState.watched });
  return { watched: row.watched };
}

export async function setWatched(db: Db, videoId: string, watched: boolean): Promise<void> {
  await db
    .insert(watchState)
    .values({ videoId, watched, updatedAt: new Date() })
    .onConflictDoUpdate({ target: watchState.videoId, set: { watched, updatedAt: new Date() } });
}

/** Removes a video from the feed without marking it watched. */
export async function dismissFromFeed(db: Db, videoId: string): Promise<void> {
  await db.update(videos).set({ dismissedAt: new Date() }).where(eq(videos.id, videoId));
}

/** "Remover do histórico": forgets the viewing (position and watched). The video itself stays in the app. */
export async function clearWatchState(db: Db, videoId: string): Promise<void> {
  await db.delete(watchState).where(eq(watchState.videoId, videoId));
}
