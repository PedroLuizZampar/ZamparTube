"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

/**
 * "Criar" on the categories and playlists pages: creates an item with a free default name, then opens its
 * name for editing in the grid. Uses replace (not push): saving or cancelling also replaces, so Back leaves
 * the page in one step.
 */
export function CreateButton({ create, basePath }: { create: () => Promise<{ id: number }>; basePath: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const { id } = await create();
              setError("");
              router.replace(`${basePath}?editar=${id}`, { scroll: false });
            } catch {
              setError("Não foi possível criar agora. Tente de novo.");
            }
          })
        }
        className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} /> Criar
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
