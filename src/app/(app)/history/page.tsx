import type { Metadata } from "next";
import { NoHistory } from "@/components/EmptyStates";
import { FeedFilterBar } from "@/components/FeedFilterBar";
import { LoadMore } from "@/components/LoadMore";
import { VideoCard, VideoGrid } from "@/components/VideoCard";
import { requireUserId } from "@/lib/auth/require";
import { getDb } from "@/lib/db/client";
import { filterParams, parseFeedFilters } from "@/lib/feed-filters";
import { canLoadMore, pageLimit } from "@/lib/paging";
import { listCategories, listChannels } from "@/lib/queries/channels";
import { listContinueWatching, listWatchedHistory } from "@/lib/queries/history";

export const metadata: Metadata = { title: "Histórico · ZamparTube" };

/** How many unfinished videos "Continuar assistindo" shows (no paging there). */
const CONTINUE_LIMIT = 12;

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const sp = await searchParams;
  const userId = await requireUserId();
  const db = getDb();
  const [categories, channels] = await Promise.all([listCategories(db, userId), listChannels(db, userId)]);
  const filters = parseFeedFilters(sp, { categoryIds: categories.map((c) => c.id), channels });
  const filtered = filters.categoryIds.length > 0 || filters.channelIds.length > 0;
  const limit = pageLimit(sp.n);
  const [started, watched] = await Promise.all([
    listContinueWatching(db, userId, { limit: CONTINUE_LIMIT, ...filters }),
    listWatchedHistory(db, userId, { limit, ...filters }),
  ]);
  const empty = started.items.length === 0 && watched.items.length === 0;

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Histórico</h1>
      {channels.length > 0 && (
        <FeedFilterBar categories={categories} channels={channels} filters={filters} basePath="/history" />
      )}
      {empty &&
        (filtered ? <p className="mt-10 text-center text-muted">Nada no histórico com esses filtros.</p> : <NoHistory />)}

      {started.items.length > 0 && (
        <section aria-labelledby="continue" className="mb-12">
          <h2 id="continue" className="mb-4 text-lg font-semibold">
            Continuar assistindo
          </h2>
          <VideoGrid>
            {started.items.map((v) => (
              <VideoCard key={v.id} video={v} onHistory />
            ))}
          </VideoGrid>
        </section>
      )}

      {watched.items.length > 0 && (
        <section aria-labelledby="watched">
          <h2 id="watched" className="mb-4 text-lg font-semibold">
            Assistidos
          </h2>
          <VideoGrid>
            {watched.items.map((v) => (
              <VideoCard key={v.id} video={v} onHistory />
            ))}
          </VideoGrid>
          {canLoadMore(watched.hasMore, limit) && (
            <LoadMore basePath="/history" params={filterParams(filters)} current={limit} />
          )}
        </section>
      )}
    </>
  );
}
