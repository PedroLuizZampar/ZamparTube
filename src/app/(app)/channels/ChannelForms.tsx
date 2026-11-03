"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  addChannelAction,
  createCategoryAction,
  deleteCategoryAction,
  removeChannelAction,
  renameCategoryAction,
  setChannelCategoryAction,
  type ActionState,
} from "./actions";

type Category = { id: number; name: string };

const input =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted/80 outline-none focus:border-accent";
const primary =
  "flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60";
const ghostIcon = "rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50";

export function AddChannelForm({ categories }: { categories: Category[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addChannelAction, { ok: true, message: "" });
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="channel" className="sr-only">
          Link, @ ou ID do canal
        </label>
        <input
          id="channel"
          name="channel"
          required
          placeholder="youtube.com/@canal, @canal ou UC…"
          className={`${input} flex-1`}
          autoComplete="off"
        />
        {categories.length > 0 && (
          <select name="categoryId" defaultValue="" className={input} aria-label="Categoria">
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <button type="submit" disabled={pending} className={primary}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
          {pending ? "Importando vídeos…" : "Adicionar"}
        </button>
      </div>
      {state.message && (
        <p role="status" className={`text-sm ${state.ok ? "text-accent" : "text-danger"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ChannelControls({
  channelId,
  title,
  categoryId,
  categories,
}: {
  channelId: string;
  title: string;
  categoryId: number | null;
  categories: Category[];
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1">
      {categories.length > 0 && (
        <select
          aria-label={`Categoria de ${title}`}
          defaultValue={categoryId ?? ""}
          disabled={pending}
          onChange={(e) => {
            const value = e.target.value ? Number(e.target.value) : null;
            start(() => setChannelCategoryAction(channelId, value));
          }}
          className={`${input} max-w-40 py-1.5`}
        >
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        disabled={pending}
        className={ghostIcon}
        title="Remover canal"
        aria-label={`Remover ${title}`}
        onClick={() => {
          if (confirm(`Remover "${title}"? Os vídeos dele saem do feed e da busca, mas continuam nas suas playlists.`)) {
            start(() => removeChannelAction(channelId));
          }
        }}
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

export function CreateCategoryForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createCategoryAction, {
    ok: true,
    message: "",
  });
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label htmlFor="new-category" className="sr-only">
          Nova categoria
        </label>
        <input id="new-category" name="name" required maxLength={60} placeholder="Nova categoria" className={`${input} flex-1`} />
        <button type="submit" disabled={pending} className={primary}>
          Criar
        </button>
      </div>
      {!state.ok && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function CategoryRow({ category }: { category: Category }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <li className="flex flex-col gap-1 py-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await renameCategoryAction(category.id, name);
              if (r.ok) setEditing(false);
              else setError(r.message);
            });
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Nome da categoria"
            maxLength={60}
            autoFocus
            className={`${input} flex-1`}
          />
          <button type="submit" disabled={pending} className={ghostIcon} aria-label="Salvar">
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={ghostIcon}
            aria-label="Cancelar"
            onClick={() => {
              setName(category.name);
              setError("");
              setEditing(false);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </form>
        {error && <p className="text-sm text-danger">{error}</p>}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 py-2">
      <span className="flex-1 truncate">{category.name}</span>
      <button type="button" className={ghostIcon} aria-label={`Renomear ${category.name}`} onClick={() => setEditing(true)}>
        <Pencil className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        disabled={pending}
        className={ghostIcon}
        aria-label={`Apagar ${category.name}`}
        onClick={() => {
          if (confirm(`Apagar a categoria "${category.name}"? Os canais dela ficam sem categoria.`)) {
            start(() => deleteCategoryAction(category.id));
          }
        }}
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </li>
  );
}
