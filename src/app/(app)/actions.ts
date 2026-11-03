"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { dismissFromFeed, saveProgress, setWatched } from "@/lib/queries/watch";
import { syncMessage } from "@/lib/sync/messages";
import { createSyncDeps, runSync } from "@/lib/sync/run-sync";

export async function syncNowAction(): Promise<{ message: string }> {
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
  await dismissFromFeed(getDb(), videoId);
  revalidatePath("/");
}

export async function setWatchedAction(videoId: string, watched: boolean): Promise<void> {
  await setWatched(getDb(), videoId, watched);
  revalidatePath("/", "layout");
}

export async function saveProgressAction(
  videoId: string,
  positionSeconds: number,
  durationSeconds: number,
): Promise<{ watched: boolean }> {
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) return { watched: false };
  return saveProgress(getDb(), videoId, positionSeconds, durationSeconds);
}
