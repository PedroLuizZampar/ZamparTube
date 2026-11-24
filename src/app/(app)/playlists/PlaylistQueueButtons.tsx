"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListPlus, ListVideo } from "lucide-react";
import { enqueuePlaylistAction, playPlaylistAction } from "@/app/(app)/queue/actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const secondary =
  "flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-border disabled:opacity-60";

/** "Tocar tudo" (the queue becomes this playlist) and "Adicionar à fila" (appended). */
export function PlaylistQueueButtons({ playlistId, queueCount }: { playlistId: number; queueCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [added, setAdded] = useState(false);

  const playAll = () =>
    start(async () => {
      const first = await playPlaylistAction(playlistId);
      if (first) router.push(`/watch/${first}`);
    });

  const playAllButton = (
    <button type="button" disabled={pending} onClick={queueCount > 0 ? undefined : playAll} className={secondary}>
      <ListVideo className="h-4 w-4" /> Tocar tudo
    </button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {queueCount > 0 ? (
        <ConfirmDialog
          trigger={playAllButton}
          title="Substituir a fila?"
          description={`A fila tem ${queueCount === 1 ? "1 vídeo" : `${queueCount} vídeos`}. “Tocar tudo” troca a fila por esta playlist.`}
          confirmLabel="Substituir e tocar"
          onConfirm={playAll}
        />
      ) : (
        playAllButton
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await enqueuePlaylistAction(playlistId);
            setAdded(true);
            setTimeout(() => setAdded(false), 1500);
          })
        }
        className={secondary}
      >
        {added ? <Check className="h-4 w-4 text-accent" strokeWidth={2.5} /> : <ListPlus className="h-4 w-4" />}
        {added ? "Adicionada à fila" : "Adicionar à fila"}
      </button>
    </div>
  );
}
