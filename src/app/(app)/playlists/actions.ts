"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import {
  addToPlaylist,
  createPlaylist,
  deletePlaylist,
  getWatchLaterId,
  moveInPlaylist,
  removeFromPlaylist,
  renamePlaylist,
} from "@/lib/queries/playlists";

export interface ActionState {
  ok: boolean;
  message: string;
}

const VIDEO_ID = /^[\w-]{6,20}$/;

function assertIds(playlistId: number, videoId?: string) {
  if (!Number.isInteger(playlistId) || playlistId <= 0) throw new Error("Playlist inválida");
  if (videoId !== undefined && !VIDEO_ID.test(videoId)) throw new Error("Vídeo inválido");
}

const done = () => revalidatePath("/", "layout");

export async function createPlaylistAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await createPlaylist(getDb(), String(form.get("name") ?? ""));
    done();
    return { ok: true, message: "" };
  } catch {
    return { ok: false, message: "Dê um nome para a playlist." };
  }
}

/** Creates a playlist and puts the video in it (from the watch page). */
export async function createPlaylistWithVideoAction(name: string, videoId: string): Promise<ActionState> {
  if (!VIDEO_ID.test(videoId)) return { ok: false, message: "Vídeo inválido" };
  try {
    const db = getDb();
    const id = await createPlaylist(db, name);
    await addToPlaylist(db, id, videoId);
    done();
    return { ok: true, message: "" };
  } catch {
    return { ok: false, message: "Dê um nome para a playlist." };
  }
}

export async function renamePlaylistAction(playlistId: number, name: string): Promise<ActionState> {
  assertIds(playlistId);
  try {
    await renamePlaylist(getDb(), playlistId, name);
    done();
    return { ok: true, message: "" };
  } catch {
    return { ok: false, message: "O nome não pode ficar vazio." };
  }
}

export async function deletePlaylistAction(playlistId: number): Promise<void> {
  assertIds(playlistId);
  await deletePlaylist(getDb(), playlistId);
  done();
  redirect("/playlists");
}

export async function setInPlaylistAction(playlistId: number, videoId: string, inPlaylist: boolean): Promise<void> {
  assertIds(playlistId, videoId);
  const db = getDb();
  if (inPlaylist) await addToPlaylist(db, playlistId, videoId);
  else await removeFromPlaylist(db, playlistId, videoId);
  done();
}

export async function setWatchLaterAction(videoId: string, inPlaylist: boolean): Promise<void> {
  const db = getDb();
  await setInPlaylistAction(await getWatchLaterId(db), videoId, inPlaylist);
}

export async function moveInPlaylistAction(playlistId: number, videoId: string, direction: "up" | "down"): Promise<void> {
  assertIds(playlistId, videoId);
  if (direction !== "up" && direction !== "down") throw new Error("Direção inválida");
  await moveInPlaylist(getDb(), playlistId, videoId, direction);
  done();
}
