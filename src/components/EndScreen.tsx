"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, RotateCcw, SkipForward, X } from "lucide-react";
import type { NavTarget } from "@/lib/queries/watch-nav";

/** Seconds the autoplay countdown waits before opening the next video. */
export const AUTOPLAY_COUNTDOWN_S = 5;

const compactButton = "flex h-9 w-9 items-center justify-center rounded-full transition-colors";
const compactNeutral = `${compactButton} bg-white/15 hover:bg-white/25`;

interface Props {
  next: NavTarget | null;
  /** "Próximo da fila" / "Próximo da playlist". */
  nextLabel: string;
  autoplay: boolean;
  /** Mini player: just the countdown and buttons. */
  compact?: boolean;
  onNext: () => void;
  onReplay: () => void;
}

export function EndScreen({ next, nextLabel, autoplay, compact = false, onNext, onReplay }: Props) {
  const [left, setLeft] = useState(AUTOPLAY_COUNTDOWN_S);
  const [cancelled, setCancelled] = useState(false);
  const counting = autoplay && !!next && !cancelled;

  useEffect(() => {
    if (!counting) return;
    if (left <= 0) {
      onNext();
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [counting, left, onNext]);

  if (compact) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black px-3 text-center text-white">
        <p className="line-clamp-1 text-xs text-white/70">
          {counting && next ? `Próximo em ${left} s: ${next.title}` : "Marcado como assistido"}
        </p>
        <div className="flex gap-2">
          {counting ? (
            <button type="button" onClick={() => setCancelled(true)} aria-label="Cancelar" className={compactNeutral}>
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={onReplay} aria-label="Assistir de novo" className={compactNeutral}>
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          {next && (
            <button type="button" onClick={onNext} aria-label={nextLabel} title={nextLabel} className={`${compactButton} bg-accent text-on-accent hover:bg-accent-hover`}>
              <SkipForward className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (counting && next) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="text-sm text-white/70">Próximo em {left} s</p>
        <button type="button" onClick={onNext} className="group flex max-w-sm flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- small preview of the next video */}
          <img
            src={next.thumbnailUrl}
            alt=""
            className="aspect-video w-56 rounded-[14px] object-cover ring-2 ring-transparent transition group-hover:ring-accent"
          />
          <span className="line-clamp-2 font-medium text-balance">{next.title}</span>
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCancelled(true)}
            className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/25"
          >
            <X className="h-4 w-4" /> Cancelar
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            <SkipForward className="h-4 w-4" /> Tocar agora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-surface px-6 text-center">
      <span className="caught-up-mark flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Check className="h-6 w-6" strokeWidth={2.5} />
      </span>
      <p className="text-lg font-semibold">Marcado como assistido</p>
      <div className="flex flex-wrap justify-center gap-2">
        {next && (
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            <SkipForward className="h-4 w-4" /> {nextLabel}
          </button>
        )}
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-border"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao feed
        </Link>
        <button
          type="button"
          onClick={onReplay}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <RotateCcw className="h-4 w-4" /> Assistir de novo
        </button>
      </div>
    </div>
  );
}
