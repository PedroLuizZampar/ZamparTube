import Link from "next/link";
import { Search, X } from "lucide-react";
import type { FeedFilters } from "@/lib/feed-filters";
import { feedHref } from "@/lib/feed-filters";

/** Search box at the top of the home page. Plain GET form to "/", so it works without JavaScript. */
export function HomeSearch({ q, filters }: { q: string; filters: FeedFilters }) {
  return (
    <form action="/" role="search" className="mb-5">
      <label htmlFor="q" className="sr-only">
        Buscar nos seus canais
      </label>
      <div className="flex items-center gap-3 rounded-full border border-border bg-surface px-5 py-2.5 focus-within:border-accent">
        <Search className="h-5 w-5 shrink-0 text-muted" />
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar nos seus canais"
          className="w-full bg-transparent text-text outline-none placeholder:text-muted/80 [&::-webkit-search-cancel-button]:hidden"
        />
        {/* Keep the feed filters so clearing the search goes back to the same filtered feed. */}
        {filters.categoryIds.length > 0 && <input type="hidden" name="categoria" value={filters.categoryIds.join(",")} />}
        {filters.channelIds.length > 0 && <input type="hidden" name="canal" value={filters.channelIds.join(",")} />}
        {q && (
          <Link
            href={feedHref(filters)}
            aria-label="Limpar busca"
            title="Limpar busca"
            className="-mr-2 shrink-0 rounded-full p-1 text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="h-4 w-4" />
          </Link>
        )}
      </div>
    </form>
  );
}
