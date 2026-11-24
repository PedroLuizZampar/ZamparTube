"use client";

import type { ReactNode } from "react";
import { SkipBack, SkipForward } from "lucide-react";
import type { NavTarget } from "@/lib/queries/watch-nav";

const navButton =
  "flex items-center justify-center rounded-full bg-accent/10 text-accent/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)] transition-[background-color,color,opacity,transform] hover:scale-105 hover:bg-accent/25 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-35";

/** ⏮ [middle] ⏭ — each side only clickable when there is somewhere to go. */
export function NavButtons({
  prev,
  next,
  onNavigate,
  children,
  small = false,
}: {
  prev: NavTarget | null;
  next: NavTarget | null;
  onNavigate: (dir: "prev" | "next") => void;
  children?: ReactNode;
  /** Mini player size. */
  small?: boolean;
}) {
  const size = small ? "h-9 w-9" : "h-12 w-12";
  const icon = small ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className={`flex items-center ${small ? "gap-3" : "gap-6"}`}>
      <button
        type="button"
        disabled={!prev}
        onClick={() => onNavigate("prev")}
        className={`${navButton} ${size}`}
        aria-label="Vídeo anterior (Shift+P)"
        title={prev ? `Anterior: ${prev.title}` : undefined}
      >
        <SkipBack className={icon} strokeWidth={1.5} />
      </button>
      {children}
      <button
        type="button"
        disabled={!next}
        onClick={() => onNavigate("next")}
        className={`${navButton} ${size}`}
        aria-label="Próximo vídeo (Shift+N)"
        title={next ? `Próximo: ${next.title}` : undefined}
      >
        <SkipForward className={icon} strokeWidth={1.5} />
      </button>
    </div>
  );
}
