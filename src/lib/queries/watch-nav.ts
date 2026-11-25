import { inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { videos } from "@/lib/db/schema";
import { getNextInPlaylist, getPrevInPlaylist } from "./playlists";
import { queueNeighbors } from "./queue";

/** A video ⏮ / ⏭ can lead to. */
export interface NavTarget {
  id: string;
  title: string;
  thumbnailUrl: string;
  href: string;
}

export type NavSource = "queue" | "playlist";

export interface WatchNav {
  prev: NavTarget | null;
  next: NavTarget | null;
  source: NavSource;
}

/** Previous/next video for the watch page: the playlist order with `?list=`, the queue otherwise. */
export async function resolveWatchNav(
  db: Db,
  userId: number,
  currentId: string,
  listId: number | null,
): Promise<WatchNav> {
  const source: NavSource = listId ? "playlist" : "queue";
  const { prev, next } = listId
    ? {
        prev: await getPrevInPlaylist(db, userId, listId, currentId),
        next: await getNextInPlaylist(db, userId, listId, currentId),
      }
    : await queueNeighbors(db, userId, currentId);

  const wanted = [prev, next].filter((id): id is string => !!id);
  const rows = wanted.length
    ? await db
        .select({ id: videos.id, title: videos.title, thumbnailUrl: videos.thumbnailUrl })
        .from(videos)
        .where(inArray(videos.id, wanted))
    : [];
  const target = (id: string | null): NavTarget | null => {
    const row = id ? rows.find((r) => r.id === id) : undefined;
    if (!row) return null;
    return { ...row, href: listId ? `/watch/${row.id}?list=${listId}` : `/watch/${row.id}` };
  };
  return { prev: target(prev), next: target(next), source };
}
