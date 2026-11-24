"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Trash2, X } from "lucide-react";
import { CreateButton } from "@/components/CreateButton";
import { ImagePicker } from "@/components/ImagePicker";
import { NameEditor } from "@/components/NameEditor";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  createPlaylistQuickAction,
  deletePlaylistAction,
  moveInPlaylistAction,
  renamePlaylistAction,
  setInPlaylistAction,
  setPlaylistImageAction,
} from "./actions";

const input =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted/80 outline-none focus:border-accent";
const ghostIcon =
  "rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-30";

/** 16:9, the same shape as the card cover. */
const PLAYLIST_IMAGE_SIZE = { width: 640, height: 360 };

/** "Criar": makes a playlist with a free default name and opens its name for editing in the grid. */
export function CreatePlaylistButton() {
  return <CreateButton create={createPlaylistQuickAction} basePath="/playlists" />;
}

/** Name + picture editing on a playlist card (opened by "Criar" or the card's pencil). */
export function PlaylistEditor({ id, name, hasImage }: { id: number; name: string; hasImage: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <NameEditor
        initial={name}
        label="Nome da playlist"
        maxLength={80}
        rename={(value) => renamePlaylistAction(id, value)}
        closeHref="/playlists"
        focusId={`rename-playlist-${id}`}
      />
      <ImagePicker action={setPlaylistImageAction.bind(null, id)} hasImage={hasImage} size={PLAYLIST_IMAGE_SIZE} />
    </div>
  );
}

/** Trash shortcut on a playlist card (never on the watch-later playlist). */
export function DeletePlaylistButton({ id, name }: { id: number; name: string }) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      title={`Apagar a playlist "${name}"?`}
      description="Só a playlist é apagada. Os vídeos continuam no app."
      confirmLabel="Apagar playlist"
      destructive
      onConfirm={() => start(() => deletePlaylistAction(id))}
      trigger={
        <button
          type="button"
          disabled={pending}
          aria-label={`Apagar ${name}`}
          title="Apagar"
          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
      }
    />
  );
}

/** Rename (every playlist) and delete (never "Assistir depois") in the playlist page header. */
export function PlaylistHeaderControls({ id, name, isWatchLater }: { id: number; name: string; isWatchLater: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const pencilRef = useRef<HTMLButtonElement>(null);

  const finish = () => {
    setError("");
    setEditing(false);
    setTimeout(() => pencilRef.current?.focus(), 0);
  };
  const cancel = () => {
    setValue(name);
    finish();
  };

  if (editing) {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await renamePlaylistAction(id, value);
            if (r.ok) finish();
            else setError(r.message);
          });
        }}
      >
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Escape" && cancel()}
          aria-label="Nome da playlist"
          aria-invalid={!!error}
          aria-describedby={error ? "playlist-name-error" : undefined}
          maxLength={80}
          autoFocus
          className={input}
        />
        <button type="submit" disabled={pending} className={ghostIcon} aria-label="Salvar nome">
          <Check className="h-4 w-4" />
        </button>
        <button type="button" className={ghostIcon} aria-label="Cancelar" onClick={cancel}>
          <X className="h-4 w-4" />
        </button>
        {error && (
          <p id="playlist-name-error" role="alert" className="w-full text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        ref={pencilRef}
        type="button"
        className={ghostIcon}
        aria-label="Renomear playlist"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {!isWatchLater && (
        <ConfirmDialog
          title={`Apagar a playlist "${name}"?`}
          description="Só a playlist é apagada. Os vídeos continuam no app."
          confirmLabel="Apagar playlist"
          destructive
          onConfirm={() => start(() => deletePlaylistAction(id))}
          trigger={
            <button type="button" disabled={pending} className={ghostIcon} aria-label="Apagar playlist">
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          }
        />
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
