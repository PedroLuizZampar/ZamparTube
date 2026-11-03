import { WATCHED_RATIO } from "@/lib/constants";

/** True once playback reached 90% of the video. */
export function shouldMarkWatched(positionSeconds: number, durationSeconds: number): boolean {
  return durationSeconds > 0 && positionSeconds >= WATCHED_RATIO * durationSeconds;
}

const END_MARGIN_SECONDS = 10;

/** Where the player should start: from the saved position, or from 0 if watched / unknown / near the end. */
export function resumeFrom(
  state: { positionSeconds: number; watched: boolean } | null,
  durationSeconds: number,
): number {
  if (!state || state.watched) return 0;
  if (durationSeconds > 0 && state.positionSeconds >= durationSeconds - END_MARGIN_SECONDS) return 0;
  return Math.max(0, Math.floor(state.positionSeconds));
}
