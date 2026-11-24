"use server";

import { requireSession } from "@/lib/auth/require";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { parseImageUpload } from "@/lib/images";
import { setImage } from "@/lib/queries/images";
import {
  addToPlaylist,
  createPlaylist,
  deletePlaylist,
  getWatchLaterId,
  moveInPlaylist,
  PlaylistNameTakenError,
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

/** User-facing message for a failed create/rename. */
function nameError(e: unknown): ActionState {
  return {
    ok: false,
    message: e instanceof PlaylistNameTakenError ? e.message : "Dê um nome para a playlist.",
  };
}

/** "Criar" on the playlists page: a new playlist with a free default name, then the page opens its name for editing. */
export async function createPlaylistQuickAction(): Promise<{ id: number }> {
  await requireSession();
  const id = await createPlaylist(getDb());
  done();
  return { id };
}

/** Creates a playlist and puts the video in it (from the watch page). */
export async function createPlaylistWithVideoAction(name: string, videoId: string): Promise<ActionState> {
  await requireSession();
  if (!VIDEO_ID.test(videoId)) return { ok: false, message: "Vídeo inválido" };
  try {
    const db = getDb();
    const id = await createPlaylist(db, name);
    await addToPlaylist(db, id, videoId);
    done();
    return { ok: true, message: "" };
  } catch (e) {
    return nameError(e);
  }
}

export async function renamePlaylistAction(playlistId: number, name: string): Promise<ActionState> {
  await requireSession();
  assertIds(playlistId);
  if (!name.trim()) return { ok: false, message: "O nome não pode ficar vazio." };
  try {
    await renamePlaylist(getDb(), playlistId, name);
    done();
    return { ok: true, message: "" };
  } catch (e) {
    if (e instanceof PlaylistNameTakenError) return nameError(e);
    return { ok: false, message: "Não foi possível renomear. Tente de novo." };
  }
}

export async function deletePlaylistAction(playlistId: number): Promise<void> {
  await requireSession();
  assertIds(playlistId);
  await deletePlaylist(getDb(), playlistId);
  done();
  redirect("/playlists");
}

export async function setInPlaylistAction(playlistId: number, videoId: string, inPlaylist: boolean): Promise<void> {
  await requireSession();
  assertIds(playlistId, videoId);
  const db = getDb();
  if (inPlaylist) await addToPlaylist(db, playlistId, videoId);
  else await removeFromPlaylist(db, playlistId, videoId);
  done();
}

export async function setWatchLaterAction(videoId: string, inPlaylist: boolean): Promise<void> {
  await requireSession();
  const db = getDb();
  await setInPlaylistAction(await getWatchLaterId(db), videoId, inPlaylist);
}

export async function moveInPlaylistAction(playlistId: number, videoId: string, direction: "up" | "down"): Promise<void> {
  await requireSession();
  assertIds(playlistId, videoId);
  if (direction !== "up" && direction !== "down") throw new Error("Direção inválida");
  await moveInPlaylist(getDb(), playlistId, videoId, direction);
  done();
}

/** Sets (form field "image") or, with form field "remove", clears the playlist's picture. */
export async function setPlaylistImageAction(id: number, form: FormData): Promise<ActionState> {
  await requireSession();
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Item inválido." };
  if (form.get("remove")) {
    await setImage(getDb(), "playlist", id, null);
    done();
    return { ok: true, message: "" };
  }
  const img = await parseImageUpload(form.get("image"));
  if ("error" in img) return { ok: false, message: img.error };
  await setImage(getDb(), "playlist", id, img);
  done();
  return { ok: true, message: "" };
}
