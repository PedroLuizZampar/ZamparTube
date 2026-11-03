"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, ChevronDown, Circle } from "lucide-react";
import { setWatchedAction } from "@/app/(app)/actions";

export function WatchedToggle({ videoId, watched }: { videoId: string; watched: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(watched);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await setWatchedAction(videoId, !optimistic);
        })
      }
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        optimistic ? "bg-accent/15 text-accent hover:bg-accent/25" : "bg-surface-2 text-text hover:bg-border"
      }`}
    >
      {optimistic ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Circle className="h-4 w-4" />}
      {optimistic ? "Assistido" : "Marcar como assistido"}
    </button>
  );
}

export function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <div className="mt-4 rounded-[14px] bg-surface p-4">
      <p className={`whitespace-pre-line break-words text-sm leading-relaxed text-text/90 ${open ? "" : "line-clamp-3"}`}>
        {text}
      </p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-2 flex items-center gap-1 text-sm font-medium text-muted hover:text-text"
      >
        {open ? "Mostrar menos" : "Mostrar mais"}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
}
