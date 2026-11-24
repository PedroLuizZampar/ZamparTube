"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { CategoryTags, type CategoryOption } from "@/components/CategoryTags";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { addChannelAction, removeChannelAction, setChannelCategoryAction, type ActionState } from "./actions";

const input =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted/80 outline-none focus:border-accent";
const primary =
  "flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60";
const ghostIcon = "rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50";

export function AddChannelForm({ categories }: { categories: CategoryOption[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addChannelAction, { ok: true, message: "" });
  // Kept between submissions, so several channels can be added to the same categories in a row.
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
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
        <button type="submit" disabled={pending} className={primary}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
          {pending ? "Importando vídeos…" : "Adicionar"}
        </button>
      </div>
      <input type="hidden" name="categoryIds" value={categoryIds.join(",")} />
      <CategoryTags
        label="o novo canal"
        categories={categories}
        selected={categoryIds}
        onToggle={(id, on) =>
          setCategoryIds((ids) => (on ? [...new Set([...ids, id])] : ids.filter((x) => x !== id)))
        }
      />
      {state.message && (
        <p role="status" className={`text-sm ${state.ok ? "text-accent" : "text-danger"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}

/** A channel's category tags; each change is saved right away. */
export function ChannelCategoryTags({
  channelId,
  title,
  categoryIds,
  categories,
}: {
  channelId: string;
  title: string;
  categoryIds: number[];
  categories: CategoryOption[];
}) {
  const [selected, setSelected] = useOptimistic(categoryIds);
  const [, start] = useTransition();
  return (
    <CategoryTags
      label={title}
      categories={categories}
      selected={selected}
      onToggle={(id, on) =>
        start(async () => {
          setSelected(on ? [...selected, id] : selected.filter((x) => x !== id));
          try {
            await setChannelCategoryAction(channelId, id, on);
          } catch {
            // The optimistic tag reverts on its own; nothing else to undo.
          }
        })
      }
    />
  );
}

export function RemoveChannelButton({ channelId, title }: { channelId: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      title={`Remover "${title}"?`}
      description="Os vídeos dele saem do feed e da busca, mas continuam nas suas playlists."
      confirmLabel="Remover canal"
      destructive
      onConfirm={() => start(() => removeChannelAction(channelId))}
      trigger={
        <button type="button" disabled={pending} className={ghostIcon} title="Remover canal" aria-label={`Remover ${title}`}>
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
      }
    />
  );
}
