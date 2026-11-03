"use client";

import Link from "next/link";
import { ArrowLeft, Check, RotateCcw, SkipForward } from "lucide-react";

export function EndScreen({ nextHref, onReplay }: { nextHref: string | null; onReplay: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-surface px-6 text-center">
      <span className="caught-up-mark flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Check className="h-6 w-6" strokeWidth={2.5} />
      </span>
      <p className="text-lg font-semibold">Marcado como assistido</p>
      <div className="flex flex-wrap justify-center gap-2">
        {nextHref && (
          <Link
            href={nextHref}
            className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            <SkipForward className="h-4 w-4" /> Próximo da playlist
          </Link>
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
