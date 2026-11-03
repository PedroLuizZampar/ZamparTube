import type { Metadata } from "next";
import { Search } from "lucide-react";
import { LoadMore } from "@/components/LoadMore";
import { VideoCard, VideoGrid } from "@/components/VideoCard";
import { getDb } from "@/lib/db/client";
import { canLoadMore, pageLimit } from "@/lib/paging";
import { searchVideos } from "@/lib/queries/videos";

export const metadata: Metadata = { title: "Busca · ZamparTube" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 200) ?? "";
  const limit = pageLimit(sp.n);
  const results = q ? await searchVideos(getDb(), q, { limit }) : null;

  return (
    <>
      <form action="/search" role="search" className="mx-auto mb-10 max-w-2xl">
        <label htmlFor="q" className="sr-only">
          Buscar nos seus canais
        </label>
        <div className="flex items-center gap-3 rounded-full border border-border bg-surface px-5 py-3 focus-within:border-accent">
          <Search className="h-5 w-5 shrink-0 text-muted" />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            autoFocus
            placeholder="Buscar nos vídeos dos seus canais"
            className="w-full bg-transparent text-text outline-none placeholder:text-muted/80"
          />
        </div>
      </form>

      {!results ? (
        <p className="text-center text-muted">Busque por título ou descrição. Só aparecem vídeos dos seus canais.</p>
      ) : results.items.length === 0 ? (
        <p className="text-center text-muted">Nada encontrado nos seus canais para “{q}”.</p>
      ) : (
        <>
          <VideoGrid>
            {results.items.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </VideoGrid>
          {canLoadMore(results.hasMore, limit) && <LoadMore basePath="/search" params={{ q }} current={limit} />}
        </>
      )}
    </>
  );
}
