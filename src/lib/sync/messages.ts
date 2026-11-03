import type { RunSyncResult } from "./run-sync";

export const QUOTA_MESSAGE = "Cota diária da API esgotada. Tente de novo amanhã.";

export function syncMessage(r: RunSyncResult): string {
  if (r.stoppedReason === "quota") return QUOTA_MESSAGE;
  if (r.stoppedReason === "budget") {
    const done = r.synced === 1 ? "Atualizado 1 canal" : `Atualizados ${r.synced} canais`;
    return `${done}; o resto continua na próxima atualização`;
  }
  return "Tudo atualizado";
}
