import { asc, isNull, sql } from "drizzle-orm";
import { channels } from "@/lib/db/schema";
import { isQuotaExceeded } from "@/lib/youtube/client";
import { syncChannel, type SyncDeps } from "./sync-channel";

export interface RunSyncResult {
  synced: number;
  remaining: number;
  stoppedReason: "done" | "budget" | "quota";
}

const DEFAULT_BUDGET_MS = 45_000;

/** Syncs active channels, least recently synced first, until done, out of time, or out of quota. */
export async function runSync(
  deps: SyncDeps,
  opts: { budgetMs?: number; nowMs?: () => number } = {},
): Promise<RunSyncResult> {
  const budgetMs = opts.budgetMs ?? DEFAULT_BUDGET_MS;
  const nowMs = opts.nowMs ?? Date.now;
  const start = nowMs();

  const ids = (
    await deps.db
      .select({ id: channels.id })
      .from(channels)
      .where(isNull(channels.removedAt))
      .orderBy(sql`${channels.lastSyncedAt} asc nulls first`, asc(channels.id))
  ).map((r) => r.id);

  let synced = 0;
  for (let i = 0; i < ids.length; i++) {
    if (i > 0 && nowMs() - start >= budgetMs) {
      return { synced, remaining: ids.length - i, stoppedReason: "budget" };
    }
    try {
      await syncChannel(deps, ids[i]);
      synced++;
    } catch (e) {
      if (isQuotaExceeded(e)) return { synced, remaining: ids.length - i, stoppedReason: "quota" };
      console.error(`[sync] canal ${ids[i]} falhou:`, e);
    }
  }
  return { synced, remaining: 0, stoppedReason: "done" };
}
