import Link from "next/link";
import { Check, Plus } from "lucide-react";

/**
 * The feed's last word: there is nothing more, and that is the point.
 * With filters on, it only speaks for the filtered view and offers the full feed.
 */
export function CaughtUp({ hadItems, filtered = false }: { hadItems: boolean; filtered?: boolean }) {
  return (
    <section
      aria-label="Fim do feed"
      className={`flex flex-col items-center text-center ${hadItems ? "mt-16 border-t border-border pt-14" : "mt-24"}`}
    >
      <span className="caught-up-mark flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Check className="h-7 w-7" strokeWidth={2.5} />
      </span>
      <h2 className="mt-5 text-xl font-semibold text-balance">
        {filtered ? "Nada mais com esses filtros" : "Você está em dia"}
      </h2>
      <p className="mt-2 max-w-sm text-muted text-pretty">
        {filtered
          ? "Outros canais podem ter novidades."
          : hadItems
            ? "Isso é tudo o que saiu nos seus canais. Pode fechar o app."
            : "Nada novo nos seus canais por enquanto. Volte mais tarde."}
      </p>
      {filtered && (
        <Link
          href="/"
          className="mt-6 rounded-full border border-border px-5 py-2 text-sm font-medium text-text transition-colors hover:border-accent hover:bg-accent/10"
        >
          Ver o feed completo
        </Link>
      )}
    </section>
  );
}

export function NoChannels() {
  return (
    <section className="mt-24 flex flex-col items-center text-center">
      <h1 className="text-2xl font-semibold text-balance">Comece pelos seus canais</h1>
      <p className="mt-3 max-w-md text-muted text-pretty">
        O ZamparTube só mostra vídeos dos canais que você escolher. Adicione o primeiro colando o link ou o @ do canal.
      </p>
      <Link
        href="/channels"
        className="mt-8 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-on-accent transition-colors hover:bg-accent-hover"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} /> Adicionar canal
      </Link>
    </section>
  );
}

export function NoHistory() {
  return (
    <section className="mt-24 flex flex-col items-center text-center">
      <p className="max-w-sm text-muted text-pretty">
        Nada por aqui ainda. Os vídeos que você começar a ver aparecem aqui.
      </p>
    </section>
  );
}
