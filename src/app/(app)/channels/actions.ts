"use server";

import { requireSession } from "@/lib/auth/require";
import { revalidatePath } from "next/cache";
import {
  createCategory,
  deleteCategory,
  removeChannel,
  renameCategory,
  setChannelCategory,
  upsertChannel,
} from "@/lib/queries/channels";
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

function parseCategoryId(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
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
    const categoryId = parseCategoryId(form.get("categoryId"));
    if (categoryId) await setChannelCategory(deps.db, info.id, categoryId);
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

export async function setChannelCategoryAction(channelId: string, categoryId: number | null): Promise<void> {
  await requireSession();
  await setChannelCategory(getDb(), channelId, categoryId);
  done();
}

export async function createCategoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  try {
    await createCategory(getDb(), String(form.get("name") ?? ""));
    done();
    return { ok: true, message: "" };
  } catch {
    return { ok: false, message: "Já existe uma categoria com esse nome (ou o nome está vazio)." };
  }
}

export async function renameCategoryAction(id: number, name: string): Promise<ActionState> {
  await requireSession();
  try {
    await renameCategory(getDb(), id, name);
    done();
    return { ok: true, message: "" };
  } catch {
    return { ok: false, message: "Nome inválido ou repetido." };
  }
}

export async function deleteCategoryAction(id: number): Promise<void> {
  await requireSession();
  await deleteCategory(getDb(), id);
  done();
}
