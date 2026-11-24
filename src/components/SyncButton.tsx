"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncNowAction } from "@/app/(app)/actions";

/** "Atualizar agora": fetch new videos, then show the result for a few seconds. */
export function useSyncNow() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(t);
  }, [message]);

  const run = useCallback(
    () =>
      new Promise<void>((resolve) =>
        start(async () => {
          try {
            setMessage((await syncNowAction()).message);
          } catch {
            setMessage("Não foi possível atualizar agora.");
          } finally {
            resolve();
          }
        }),
      ),
    [],
  );

  return { pending, message, run };
}

/**
 * The sidebar's highlighted refresh button (full or icon-only when the sidebar is collapsed), or the small one in
 * the phone header (`compact`).
 */
export function SyncButton({ compact = false, collapsed = false }: { compact?: boolean; collapsed?: boolean }) {
  const { pending, message, run } = useSyncNow();
  const iconOnly = compact || collapsed;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        title={iconOnly ? "Atualizar agora" : undefined}
        className={`flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-wait disabled:opacity-80 ${
          compact
            ? "h-9 w-9 bg-accent/15 text-accent hover:bg-accent/25"
            : `bg-accent text-sm text-on-accent shadow-[0_6px_20px_rgba(0,0,0,0.35)] hover:bg-accent-hover ${
                collapsed ? "mx-auto h-11 w-11" : "w-full px-4 py-2.5"
              }`
        }`}
        aria-label="Atualizar agora"
      >
        <RefreshCw className={`h-5 w-5 ${pending ? "animate-spin" : ""}`} strokeWidth={2} />
        {!iconOnly && (pending ? "Atualizando…" : "Atualizar agora")}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={`absolute z-40 w-64 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-opacity ${
          compact ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2"
        } ${message ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {message}
      </p>
    </div>
  );
}
