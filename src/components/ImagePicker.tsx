"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { resizeImage } from "@/lib/client/resize-image";

type Result = { ok: boolean; message: string };

/**
 * "Escolher imagem" / "Remover imagem" for a category or playlist. The file is cropped and scaled in the
 * browser (so uploads stay small) and sent to `action` as form field "image"; removal sends "remove".
 */
export function ImagePicker({
  action,
  hasImage,
  size,
}: {
  action: (form: FormData) => Promise<Result>;
  hasImage: boolean;
  size: { width: number; height: number };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const send = (form: FormData) =>
    start(async () => {
      try {
        const r = await action(form);
        setError(r.ok ? "" : r.message);
      } catch {
        setError("Não foi possível salvar a imagem. Tente de novo.");
      }
    });

  const button =
    "flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-border disabled:opacity-60";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const blob = await resizeImage(file, size);
              const form = new FormData();
              form.set("image", new File([blob], "imagem", { type: blob.type }));
              send(form);
            } catch {
              setError("Não foi possível ler essa imagem.");
            }
          }}
        />
        <button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className={button}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {hasImage ? "Trocar imagem" : "Escolher imagem"}
        </button>
        {hasImage && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const form = new FormData();
              form.set("remove", "1");
              send(form);
            }}
            className={button}
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover imagem
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
