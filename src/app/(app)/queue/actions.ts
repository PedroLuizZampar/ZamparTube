"use server";

import { requireUserId } from "@/lib/auth/require";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { loadNowPlaying, type CurrentVideo } from "@/lib/queries/now-playing";
import { getPlaylist, listPlaylistVideos } from "@/lib/queries/playlists";
import {
  clearQueue,
  enqueue,
  markPlaying,
  moveInQueue,
  removeFromQueue,
  replaceQueue,
} from "@/lib/queries/queue";

const VIDEO_ID = /^[\w-]{6,20}$/;

function assertVideo(id: string) {
  if (typeof id !== "string" || !VIDEO_ID.test(id)) throw new Error("Vídeo inválido");
}
function assertPlaylist(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Playlist inválida");
}

const done = () => revalidatePath("/", "layout");

export async function enqueueAction(videoIds: string[], mode: "end" | "next"): Promise<void> {
  const userId = await requireUserId();
  if (!Array.isArray(videoIds) || videoIds.length > 500) throw new Error("Lista inválida");
  videoIds.forEach(assertVideo);
  await enqueue(getDb(), userId, videoIds, mode === "next" ? "next" : "end");
  done();
}

export async function removeFromQueueAction(videoId: string): Promise<void> {
  const userId = await requireUserId();
  assertVideo(videoId);
  await removeFromQueue(getDb(), userId, videoId);
  done();
}

export async function moveInQueueAction(videoId: string, toIndex: number): Promise<void> {
  const userId = await requireUserId();
  assertVideo(videoId);
  if (!Number.isInteger(toIndex) || toIndex < 0) throw new Error("Posição inválida");
  await moveInQueue(getDb(), userId, videoId, toIndex);
  done();
}

export async function clearQueueAction(): Promise<void> {
  const userId = await requireUserId();
  await clearQueue(getDb(), userId);
  done();
}

/** "Tocar tudo": the queue becomes the playlist. Returns the first video to open, or null if it is empty. */
export async function playPlaylistAction(playlistId: number): Promise<string | null> {
  const userId = await requireUserId();
  assertPlaylist(playlistId);
  const db = getDb();
  const ids = (await listPlaylistVideos(db, userId, playlistId)).map((v) => v.id);
  await replaceQueue(db, userId, ids);
  done();
  return ids[0] ?? null;
}

export async function enqueuePlaylistAction(playlistId: number): Promise<void> {
  const userId = await requireUserId();
  assertPlaylist(playlistId);
  const db = getDb();
  await enqueue(db, userId, (await listPlaylistVideos(db, userId, playlistId)).map((v) => v.id), "end");
  done();
}

/** The video started playing: it becomes where the queue stopped (it stays in the queue). */
export async function markPlayingAction(videoId: string): Promise<void> {
  const userId = await requireUserId();
  assertVideo(videoId);
  await markPlaying(getDb(), userId, videoId);
  done();
}

/** The mini player moves on (⏮/⏭, autoplay) without leaving the page: what it should play next. */
export async function loadNowPlayingAction(videoId: string, listId: number | null): Promise<CurrentVideo | null> {
  const userId = await requireUserId();
  assertVideo(videoId);
  const db = getDb();
  if (listId !== null) assertPlaylist(listId);
  const list = listId !== null && (await getPlaylist(db, userId, listId)) ? listId : null;
  return loadNowPlaying(db, userId, videoId, list);
}
