"use client";

import { useActionState, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createPlaylistAction,
  deletePlaylistAction,
  moveInPlaylistAction,
  renamePlaylistAction,
  setInPlaylistAction,
  type ActionState,
} from "./actions";

const input =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted/80 outline-none focus:border-accent";
const ghostIcon =
  "rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-30";

export function CreatePlaylistForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createPlaylistAction, { ok: true, message: "" });
  return (
    <form action={action} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <label htmlFor="new-playlist" className="sr-only">
          Nome da nova playlist
        </label>
        <input id="new-playlist" name="name" required maxLength={80} placeholder="Nova playlist" className={input} />
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Criar
        </button>
      </div>
      {!state.ok && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function PlaylistHeaderControls({ id, name, isWatchLater }: { id: number; name: string; isWatchLater: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await renamePlaylistAction(id, value);
            if (r.ok) setEditing(false);
            else setError(r.message);
          });
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Nome da playlist"
          maxLength={80}
          autoFocus
          className={input}
        />
        <button type="submit" disabled={pending} className={ghostIcon} aria-label="Salvar nome">
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={ghostIcon}
          aria-label="Cancelar"
          onClick={() => {
            setValue(name);
            setError("");
            setEditing(false);
          }}
        >
          <X className="h-4 w-4" />
        </button>
        {error && <p className="w-full text-sm text-danger">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" className={ghostIcon} aria-label="Renomear playlist" onClick={() => setEditing(true)}>
        <Pencil className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {!isWatchLater && (
        <button
          type="button"
          disabled={pending}
          className={ghostIcon}
          aria-label="Apagar playlist"
          onClick={() => {
            if (confirm(`Apagar a playlist "${name}"? Os vídeos continuam no app.`)) start(() => deletePlaylistAction(id));
          }}
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

export function PlaylistItemControls({
  playlistId,
  videoId,
  title,
  isFirst,
  isLast,
}: {
  playlistId: number;
  videoId: string;
  title: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        disabled={pending || isFirst}
        className={ghostIcon}
        aria-label={`Subir "${title}"`}
        onClick={() => start(() => moveInPlaylistAction(playlistId, videoId, "up"))}
      >
        <ArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={pending || isLast}
        className={ghostIcon}
        aria-label={`Descer "${title}"`}
        onClick={() => start(() => moveInPlaylistAction(playlistId, videoId, "down"))}
      >
        <ArrowDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={pending}
        className={ghostIcon}
        aria-label={`Tirar "${title}" da playlist`}
        onClick={() => start(() => setInPlaylistAction(playlistId, videoId, false))}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
