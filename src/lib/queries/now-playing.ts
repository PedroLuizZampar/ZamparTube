import type { Db } from "@/lib/db/client";
import { resumeFrom } from "@/lib/player/progress";
import { getVisibleVideo } from "./videos";
import { resolveWatchNav, type NavSource, type NavTarget } from "./watch-nav";

/** What the persistent player needs about the video it plays. */
export interface CurrentVideo {
  id: string;
  title: string;
  channelTitle: string;
  durationSeconds: number;
  startAt: number;
  thumbnailUrl: string;
  embeddable: boolean;
  /** The watch page of this video (keeps `?list=`), for the mini player's "expand". */
  href: string;
  listId: number | null;
  prev: NavTarget | null;
  next: NavTarget | null;
  source: NavSource;
}

/** Builds the player's view of a video, or null if it cannot be shown. `listId` must be an existing playlist. */
export async function loadNowPlaying(db: Db, id: string, listId: number | null): Promise<CurrentVideo | null> {
  const [video, nav] = await Promise.all([getVisibleVideo(db, id), resolveWatchNav(db, id, listId)]);
  if (!video) return null;
  return {
    id: video.id,
    title: video.title,
    channelTitle: video.channelTitle,
    durationSeconds: video.durationSeconds,
    startAt: resumeFrom({ positionSeconds: video.positionSeconds, watched: video.watched }, video.durationSeconds),
    thumbnailUrl: video.thumbnailUrl,
    embeddable: video.embeddable,
    href: listId ? `/watch/${video.id}?list=${listId}` : `/watch/${video.id}`,
    listId,
    prev: nav.prev,
    next: nav.next,
    source: nav.source,
  };
}
