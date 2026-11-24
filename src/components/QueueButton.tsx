"use client";

import { useOptimistic, useTransition } from "react";
import { Check, ListPlus } from "lucide-react";
import { enqueueAction, removeFromQueueAction } from "@/app/(app)/queue/actions";

/** "Adicionar à fila" on the watch page; pressed again it takes the video back out. */
export function QueueButton({ videoId, queued }: { videoId: string; queued: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(queued);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      title={optimistic ? "Remover da fila" : "Adicionar ao fim da fila"}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          if (optimistic) await removeFromQueueAction(videoId);
          else await enqueueAction([videoId], "end");
        })
      }
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        optimistic ? "bg-accent/15 text-accent hover:bg-accent/25" : "bg-surface-2 hover:bg-border"
      }`}
    >
      {optimistic ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <ListPlus className="h-4 w-4" />}
      {optimistic ? "Na fila" : "Adicionar à fila"}
    </button>
  );
}
