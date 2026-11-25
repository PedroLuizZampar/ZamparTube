import { and, asc, desc, eq, gt, lt, ne, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { channels, playlistItems, playlists, videos, watchState } from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/db/errors";
import { imageSrcSql } from "./images";
import { cardFields, watchStateOf, type VideoCardData } from "./videos";
import { visibleVideoCondition } from "./visibility";

/*
 * Every playlist belongs to one user. Functions taking a playlist id do nothing (or return nothing) for a playlist
 * of someone else, so ids coming from the browser are safe to pass straight through.
 */

export interface PlaylistSummary {
  id: number;
  name: string;
  isWatchLater: boolean;
  count: number;
  coverThumbnailUrl: string | null;
  /** Local URL of the uploaded picture, or "" (then the cover is the first video's thumbnail). */
  imageSrc: string;
}

const visibleItemsOf = (playlistId: unknown) =>
  sql`from ${playlistItems} join ${videos} on ${videos.id} = ${playlistItems.videoId}
      where ${playlistItems.playlistId} = ${playlistId} and ${visibleVideoCondition()}`;

/** The user's playlists: "Assistir depois" first, then the others in creation order. Counts only visible videos. */
export async function listPlaylists(db: Db, userId: number): Promise<PlaylistSummary[]> {
  return db
    .select({
      id: playlists.id,
      name: playlists.name,
      isWatchLater: playlists.isWatchLater,
      imageSrc: imageSrcSql("playlist"),
      count: sql<number>`(select count(*) ${visibleItemsOf(playlists.id)})`.mapWith(Number),
      coverThumbnailUrl: sql<string | null>`(select ${videos.thumbnailUrl} ${visibleItemsOf(playlists.id)}
        order by ${playlistItems.position} limit 1)`,
    })
    .from(playlists)
    .where(eq(playlists.userId, userId))
    .orderBy(desc(playlists.isWatchLater), asc(playlists.createdAt), asc(playlists.id));
}

/** One of the user's playlists, or null (also when it belongs to someone else). */
export async function getPlaylist(
  db: Db,
  userId: number,
  id: number,
): Promise<{ id: number; name: string; isWatchLater: boolean } | null> {
  const [row] = await db
    .select({ id: playlists.id, name: playlists.name, isWatchLater: playlists.isWatchLater })
    .from(playlists)
    .where(and(eq(playlists.id, id), eq(playlists.userId, userId)));
  return row ?? null;
}

async function owns(db: Db, userId: number, playlistId: number): Promise<boolean> {
  return (await getPlaylist(db, userId, playlistId)) !== null;
}

async function findWatchLaterId(db: Db, userId: number): Promise<number | null> {
  const [row] = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.userId, userId), eq(playlists.isWatchLater, true)));
  return row?.id ?? null;
}

const DEFAULT_WATCH_LATER_NAME = "Assistir depois";

/** The user's built-in "Assistir depois" playlist, created on first use. */
export async function getWatchLaterId(db: Db, userId: number): Promise<number> {
  const existing = await findWatchLaterId(db, userId);
  if (existing !== null) return existing;
  const [created] = await db
    .insert(playlists)
    .values({ userId, name: DEFAULT_WATCH_LATER_NAME, isWatchLater: true })
    .onConflictDoNothing()
    .returning({ id: playlists.id });
  if (created) return created.id;
  // A concurrent request created it, or a user playlist holds the name: look once more, never loop.
  const again = await findWatchLaterId(db, userId);
  if (again === null) throw new Error('Não foi possível criar a playlist "Assistir depois"');
  return again;
}

/**
 * The watch-later playlist's name for labels, read-only (safe while rendering the layout): one query, never creates
 * the row; falls back to the default name when it is missing.
 */
export async function readWatchLaterName(db: Db, userId: number): Promise<string> {
  const [row] = await db
    .select({ name: playlists.name })
    .from(playlists)
    .where(and(eq(playlists.userId, userId), eq(playlists.isWatchLater, true)))
    .limit(1);
  return row?.name ?? DEFAULT_WATCH_LATER_NAME;
}

/** Thrown when another playlist of the user already uses the name (case-insensitive). */
export class PlaylistNameTakenError extends Error {
  constructor() {
    super("Já existe uma playlist com esse nome.");
    this.name = "PlaylistNameTakenError";
  }
}

const DEFAULT_NAME = "Nova playlist";

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("O nome não pode ficar vazio");
  return trimmed.slice(0, 80);
}

async function nameTaken(db: Db, userId: number, name: string, exceptId?: number): Promise<boolean> {
  const [row] = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(
      and(
        eq(playlists.userId, userId),
        sql`lower(${playlists.name}) = lower(${name})`,
        exceptId === undefined ? undefined : ne(playlists.id, exceptId),
      ),
    )
    .limit(1);
  return !!row;
}

/** "Nova playlist", then "Nova playlist 2", "Nova playlist 3"… whichever is free first. */
async function freeDefaultName(db: Db, userId: number): Promise<string> {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? DEFAULT_NAME : `${DEFAULT_NAME} ${n}`;
    if (!(await nameTaken(db, userId, candidate))) return candidate;
  }
}

/** Creates a playlist; without a name it picks a free "Nova playlist" name. Names are unique per user ignoring case. */
export async function createPlaylist(db: Db, userId: number, name?: string): Promise<number> {
  const clean = name === undefined ? await freeDefaultName(db, userId) : cleanName(name);
  if (await nameTaken(db, userId, clean)) throw new PlaylistNameTakenError();
  try {
    const [row] = await db.insert(playlists).values({ userId, name: clean }).returning({ id: playlists.id });
    return row.id;
  } catch (e) {
    throw isUniqueViolation(e) ? new PlaylistNameTakenError() : e;
  }
}

/** Renames a playlist, the watch-later one included (it stays undeletable). A case change of its own name is allowed. */
export async function renamePlaylist(db: Db, userId: number, id: number, name: string): Promise<void> {
  const clean = cleanName(name);
  if (!(await owns(db, userId, id))) throw new Error("Playlist não encontrada");
  if (await nameTaken(db, userId, clean, id)) throw new PlaylistNameTakenError();
  try {
    await db.update(playlists).set({ name: clean }).where(eq(playlists.id, id));
  } catch (e) {
    throw isUniqueViolation(e) ? new PlaylistNameTakenError() : e;
  }
}

export async function deletePlaylist(db: Db, userId: number, id: number): Promise<void> {
  const p = await getPlaylist(db, userId, id);
  if (!p) return;
  if (p.isWatchLater) throw new Error("A playlist Assistir depois não pode ser apagada");
  await db.delete(playlists).where(eq(playlists.id, id));
}

/** Appends to the end; adding a video that is already there does nothing. */
export async function addToPlaylist(db: Db, userId: number, playlistId: number, videoId: string): Promise<void> {
  if (!(await owns(db, userId, playlistId))) return;
  await db
    .insert(playlistItems)
    .values({
      playlistId,
      videoId,
      position: sql`(select coalesce(max(${playlistItems.position}) + 1, 0) from ${playlistItems}
        where ${playlistItems.playlistId} = ${playlistId})`,
    })
    .onConflictDoNothing();
}

export async function removeFromPlaylist(db: Db, userId: number, playlistId: number, videoId: string): Promise<void> {
  if (!(await owns(db, userId, playlistId))) return;
  await db
    .delete(playlistItems)
    .where(and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.videoId, videoId)));
}

async function positionOf(db: Db, playlistId: number, videoId: string): Promise<number | null> {
  const [row] = await db
    .select({ position: playlistItems.position })
    .from(playlistItems)
    .where(and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.videoId, videoId)));
  return row?.position ?? null;
}

/** The closest visible item before (up) or after (down) a position. */
async function visibleNeighbour(db: Db, playlistId: number, position: number, direction: "up" | "down") {
  const [row] = await db
    .select({ videoId: playlistItems.videoId, position: playlistItems.position })
    .from(playlistItems)
    .innerJoin(videos, eq(videos.id, playlistItems.videoId))
    .where(
      and(
        eq(playlistItems.playlistId, playlistId),
        direction === "up" ? lt(playlistItems.position, position) : gt(playlistItems.position, position),
        visibleVideoCondition(),
      ),
    )
    .orderBy(direction === "up" ? desc(playlistItems.position) : asc(playlistItems.position))
    .limit(1);
  return row ?? null;
}

/** Swaps a video with its visible neighbour in one statement; no-op at the edges. */
export async function moveInPlaylist(
  db: Db,
  userId: number,
  playlistId: number,
  videoId: string,
  direction: "up" | "down",
): Promise<void> {
  if (!(await owns(db, userId, playlistId))) return;
  const position = await positionOf(db, playlistId, videoId);
  if (position === null) return;
  const other = await visibleNeighbour(db, playlistId, position, direction);
  if (!other) return;
  await db
    .update(playlistItems)
    .set({
      position: sql`case when ${playlistItems.videoId} = ${videoId} then ${other.position}::int else ${position}::int end`,
    })
    .where(
      and(
        eq(playlistItems.playlistId, playlistId),
        sql`${playlistItems.videoId} in (${videoId}, ${other.videoId})`,
      ),
    );
}

/** Visible videos of one of the user's playlists in order (empty for someone else's). */
export async function listPlaylistVideos(db: Db, userId: number, playlistId: number): Promise<VideoCardData[]> {
  return db
    .select(cardFields(userId))
    .from(playlistItems)
    .innerJoin(playlists, eq(playlists.id, playlistItems.playlistId))
    .innerJoin(videos, eq(videos.id, playlistItems.videoId))
    .innerJoin(channels, eq(channels.id, videos.channelId))
    .leftJoin(watchState, watchStateOf(userId))
    .where(and(eq(playlistItems.playlistId, playlistId), eq(playlists.userId, userId), visibleVideoCondition()))
    .orderBy(asc(playlistItems.position));
}

export async function getNextInPlaylist(
  db: Db,
  userId: number,
  playlistId: number,
  currentVideoId: string,
): Promise<string | null> {
  if (!(await owns(db, userId, playlistId))) return null;
  const position = await positionOf(db, playlistId, currentVideoId);
  if (position === null) return null;
  return (await visibleNeighbour(db, playlistId, position, "down"))?.videoId ?? null;
}

export async function getPrevInPlaylist(
  db: Db,
  userId: number,
  playlistId: number,
  currentVideoId: string,
): Promise<string | null> {
  if (!(await owns(db, userId, playlistId))) return null;
  const position = await positionOf(db, playlistId, currentVideoId);
  if (position === null) return null;
  return (await visibleNeighbour(db, playlistId, position, "up"))?.videoId ?? null;
}

/** Ids of the user's playlists that hold the video. */
export async function playlistsContaining(db: Db, userId: number, videoId: string): Promise<number[]> {
  const rows = await db
    .select({ id: playlistItems.playlistId })
    .from(playlistItems)
    .innerJoin(playlists, eq(playlists.id, playlistItems.playlistId))
    .where(and(eq(playlistItems.videoId, videoId), eq(playlists.userId, userId)));
  return rows.map((r) => r.id);
}
