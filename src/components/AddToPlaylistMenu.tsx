"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Check, Clock, ListPlus, Plus } from "lucide-react";
import {
  createPlaylistWithVideoAction,
  setInPlaylistAction,
  setWatchLaterAction,
} from "@/app/(app)/playlists/actions";
import { useWatchLaterName } from "./WatchLaterName";

type Playlist = { id: number; name: string; isWatchLater: boolean };

const pill = "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors";

export function WatchLaterButton({ videoId, saved }: { videoId: string; saved: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [, start] = useTransition();
  const name = useWatchLaterName();
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      title={optimistic ? `Remover de “${name}”` : `Salvar em “${name}”`}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await setWatchLaterAction(videoId, !optimistic);
        })
      }
      className={`${pill} ${optimistic ? "bg-accent/15 text-accent hover:bg-accent/25" : "bg-surface-2 hover:bg-border"}`}
    >
      {optimistic ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Clock className="h-4 w-4" />}
      <span className="max-w-48 truncate">{name}</span>
    </button>
  );
}

export function AddToPlaylistMenu({
  videoId,
  playlists,
  containing,
}: {
  videoId: string;
  playlists: Playlist[];
  containing: number[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const others = playlists.filter((p) => !p.isWatchLater);
  const inSet = new Set(containing);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={`${pill} bg-surface-2 hover:bg-border`}
      >
        <ListPlus className="h-4 w-4" /> Salvar na playlist
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-[14px] border border-border bg-surface-2 p-2 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
          {others.length === 0 && <p className="px-2 py-1.5 text-sm text-muted">Você ainda não tem playlists.</p>}
          <ul className="max-h-64 overflow-y-auto">
            {others.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-border">
                  <input
                    type="checkbox"
                    defaultChecked={inSet.has(p.id)}
                    disabled={pending}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      start(() => setInPlaylistAction(p.id, videoId, checked));
                    }}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                  <span className="truncate">{p.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <form
            className="mt-1 flex gap-2 border-t border-border pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await createPlaylistWithVideoAction(name, videoId);
                if (r.ok) {
                  setName("");
                  setError("");
                } else setError(r.message);
              });
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nova playlist"
              aria-label="Nome da nova playlist"
              maxLength={80}
              className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={pending || !name.trim()}
              aria-label="Criar playlist com este vídeo"
              className="rounded-full bg-accent p-2 text-on-accent hover:bg-accent-hover disabled:opacity-50"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </form>
          {error && <p className="px-2 pt-1 text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
