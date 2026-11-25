"use server";

import { requireUserId } from "@/lib/auth/require";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { clearWatchState, dismissFromFeed, saveProgress, setWatched } from "@/lib/queries/watch";
import { syncMessage } from "@/lib/sync/messages";
import { createSyncDeps, runSync } from "@/lib/sync/run-sync";

export async function syncNowAction(): Promise<{ message: string }> {
  await requireUserId();
  try {
    const result = await runSync(createSyncDeps(), { budgetMs: 45_000 });
    revalidatePath("/", "layout");
    return { message: syncMessage(result) };
  } catch (e) {
    console.error("[sync] falhou:", e);
    return { message: "Não foi possível atualizar agora. Tente de novo em instantes." };
  }
}

export async function dismissAction(videoId: string): Promise<void> {
  const userId = await requireUserId();
  await dismissFromFeed(getDb(), userId, videoId);
  revalidatePath("/");
}

export async function removeFromHistoryAction(videoId: string): Promise<void> {
  const userId = await requireUserId();
  await clearWatchState(getDb(), userId, videoId);
  revalidatePath("/", "layout");
}

export async function setWatchedAction(videoId: string, watched: boolean): Promise<void> {
  const userId = await requireUserId();
  await setWatched(getDb(), userId, videoId, watched);
  revalidatePath("/", "layout");
}

export async function saveProgressAction(
  videoId: string,
  positionSeconds: number,
  durationSeconds: number,
): Promise<{ watched: boolean }> {
  const userId = await requireUserId();
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) return { watched: false };
  return saveProgress(getDb(), userId, videoId, positionSeconds, durationSeconds);
}
