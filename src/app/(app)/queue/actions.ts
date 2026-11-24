"use server";

import { requireSession } from "@/lib/auth/require";
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
  await requireSession();
  if (!Array.isArray(videoIds) || videoIds.length > 500) throw new Error("Lista inválida");
  videoIds.forEach(assertVideo);
  await enqueue(getDb(), videoIds, mode === "next" ? "next" : "end");
  done();
}

export async function removeFromQueueAction(videoId: string): Promise<void> {
  await requireSession();
  assertVideo(videoId);
  await removeFromQueue(getDb(), videoId);
  done();
}

export async function moveInQueueAction(videoId: string, toIndex: number): Promise<void> {
  await requireSession();
  assertVideo(videoId);
  if (!Number.isInteger(toIndex) || toIndex < 0) throw new Error("Posição inválida");
  await moveInQueue(getDb(), videoId, toIndex);
  done();
}

export async function clearQueueAction(): Promise<void> {
  await requireSession();
  await clearQueue(getDb());
  done();
}

/** "Tocar tudo": the queue becomes the playlist. Returns the first video to open, or null if it is empty. */
export async function playPlaylistAction(playlistId: number): Promise<string | null> {
  await requireSession();
  assertPlaylist(playlistId);
  const db = getDb();
  const ids = (await listPlaylistVideos(db, playlistId)).map((v) => v.id);
  await replaceQueue(db, ids);
  done();
  return ids[0] ?? null;
}

export async function enqueuePlaylistAction(playlistId: number): Promise<void> {
  await requireSession();
  assertPlaylist(playlistId);
  const db = getDb();
  await enqueue(db, (await listPlaylistVideos(db, playlistId)).map((v) => v.id), "end");
  done();
}

/** The video started playing: it becomes where the queue stopped (it stays in the queue). */
export async function markPlayingAction(videoId: string): Promise<void> {
  await requireSession();
  assertVideo(videoId);
  await markPlaying(getDb(), videoId);
  done();
}

/** The mini player moves on (⏮/⏭, autoplay) without leaving the page: what it should play next. */
export async function loadNowPlayingAction(videoId: string, listId: number | null): Promise<CurrentVideo | null> {
  await requireSession();
  assertVideo(videoId);
  const db = getDb();
  if (listId !== null) assertPlaylist(listId);
  const list = listId !== null && (await getPlaylist(db, listId)) ? listId : null;
  return loadNowPlaying(db, videoId, list);
}
