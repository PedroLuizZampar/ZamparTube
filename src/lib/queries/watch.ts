import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { feedDismissals, watchState } from "@/lib/db/schema";
import { shouldMarkWatched } from "@/lib/player/progress";

/** Saves the user's playback position; marks watched at 90% and never un-marks. */
export async function saveProgress(
  db: Db,
  userId: number,
  videoId: string,
  positionSeconds: number,
  durationSeconds: number,
): Promise<{ watched: boolean }> {
  const position = Math.max(0, Math.floor(positionSeconds));
  const reached = shouldMarkWatched(positionSeconds, durationSeconds);
  const [row] = await db
    .insert(watchState)
    .values({ userId, videoId, positionSeconds: position, watched: reached, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [watchState.userId, watchState.videoId],
      set: {
        positionSeconds: position,
        watched: sql`${watchState.watched} or excluded.watched`,
        updatedAt: new Date(),
      },
    })
    .returning({ watched: watchState.watched });
  return { watched: row.watched };
}

export async function setWatched(db: Db, userId: number, videoId: string, watched: boolean): Promise<void> {
  await db
    .insert(watchState)
    .values({ userId, videoId, watched, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [watchState.userId, watchState.videoId], set: { watched, updatedAt: new Date() } });
}

/** Removes a video from the user's feed without marking it watched. */
export async function dismissFromFeed(db: Db, userId: number, videoId: string): Promise<void> {
  await db.insert(feedDismissals).values({ userId, videoId }).onConflictDoNothing();
}

/** "Remover do histórico": forgets the user's viewing (position and watched). The video itself stays in the app. */
export async function clearWatchState(db: Db, userId: number, videoId: string): Promise<void> {
  await db.delete(watchState).where(and(eq(watchState.userId, userId), eq(watchState.videoId, videoId)));
}
