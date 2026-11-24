"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

type Result = { ok: boolean; message: string };

/** After the grid re-renders without the editor, put keyboard focus back on the card's rename control. */
function focusWhenReady(id: string) {
  let tries = 0;
  const tick = () => {
    const el = document.getElementById(id);
    if (el) el.focus();
    else if (++tries < 40) setTimeout(tick, 50);
  };
  setTimeout(tick, 50);
}

/**
 * Inline name field on a card (opened by "Criar" or the card's pencil). Enter saves, Esc or ✕ cancels;
 * both return to `closeHref` and focus `focusId`.
 */
export function NameEditor({
  initial,
  label,
  maxLength,
  rename,
  closeHref,
  focusId,
}: {
  initial: string;
  label: string;
  maxLength: number;
  rename: (name: string) => Promise<Result>;
  closeHref: string;
  focusId: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const close = () => {
    router.replace(closeHref, { scroll: false });
    focusWhenReady(focusId);
  };
  const ghostIcon = "rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50";
  const errorId = `${focusId}-error`;

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await rename(value);
          if (r.ok) close();
          else setError(r.message);
        });
      }}
    >
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => e.key === "Escape" && close()}
          aria-label={label}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          maxLength={maxLength}
          autoFocus
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none placeholder:text-muted/80 focus:border-accent"
        />
        <button type="submit" disabled={pending} className={ghostIcon} aria-label="Salvar nome">
          <Check className="h-4 w-4" />
        </button>
        <button type="button" onClick={close} className={ghostIcon} aria-label="Cancelar">
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
