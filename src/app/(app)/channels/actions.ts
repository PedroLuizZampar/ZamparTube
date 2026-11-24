"use server";

import { requireSession } from "@/lib/auth/require";
import { revalidatePath } from "next/cache";
import { removeChannel, setChannelInCategory, upsertChannel } from "@/lib/queries/channels";
import { QUOTA_MESSAGE } from "@/lib/sync/messages";
import { createSyncDeps } from "@/lib/sync/run-sync";
import { syncChannel } from "@/lib/sync/sync-channel";
import { isQuotaExceeded } from "@/lib/youtube/client";
import { parseChannelInput } from "@/lib/youtube/parse";
import { getDb } from "@/lib/db/client";

export interface ActionState {
  ok: boolean;
  message: string;
}

const done = () => revalidatePath("/", "layout");

/** "1,3" → [1, 3]; anything that is not a positive integer is dropped. */
function parseCategoryIds(value: FormDataEntryValue | null): number[] {
  return String(value ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

export async function addChannelAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = parseChannelInput(String(form.get("channel") ?? ""));
  if (!parsed.ok) return { ok: false, message: parsed.error };

  try {
    const deps = createSyncDeps();
    const info = await deps.yt.getChannel(parsed.ref);
    if (!info) return { ok: false, message: "Canal não encontrado. Confira o link ou o @." };
    await upsertChannel(deps.db, info);
    const categoryIds = parseCategoryIds(form.get("categoryIds"));
    // Adds the chosen categories; re-adding a channel never takes away categories it already had.
    for (const id of categoryIds) await setChannelInCategory(deps.db, info.id, id, true).catch(() => {});
    const r = await syncChannel(deps, info.id);
    done();
    const count = r.inserted === 1 ? "1 vídeo" : `${r.inserted} vídeos`;
    return { ok: true, message: `Canal adicionado: ${info.title} (${count})` };
  } catch (e) {
    if (isQuotaExceeded(e)) return { ok: false, message: QUOTA_MESSAGE };
    console.error("[canais] falha ao adicionar:", e);
    return { ok: false, message: "Não foi possível adicionar o canal agora. Tente de novo." };
  }
}

export async function removeChannelAction(channelId: string): Promise<void> {
  await requireSession();
  await removeChannel(getDb(), channelId);
  done();
}

/** Puts the channel in a category (on) or takes it out (off). */
export async function setChannelCategoryAction(channelId: string, categoryId: number, on: boolean): Promise<void> {
  await requireSession();
  if (!Number.isInteger(categoryId) || categoryId <= 0) return;
  await setChannelInCategory(getDb(), channelId, categoryId, on);
  done();
}
