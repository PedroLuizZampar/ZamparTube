import { CaughtUp, NoChannels } from "@/components/EmptyStates";
import { FeedFilterBar } from "@/components/FeedFilterBar";
import { HomeSearch } from "@/components/HomeSearch";
import { LoadMore } from "@/components/LoadMore";
import { VideoCard, VideoGrid } from "@/components/VideoCard";
import { requireUserId } from "@/lib/auth/require";
import { getDb } from "@/lib/db/client";
import { filterParams, parseFeedFilters } from "@/lib/feed-filters";
import { canLoadMore, pageLimit } from "@/lib/paging";
import { listCategories, listChannels } from "@/lib/queries/channels";
import { listFeed, searchVideos } from "@/lib/queries/videos";
import type { Metadata } from "next";

export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 200);
  return { title: q ? `Busca: ${q} · ZamparTube` : "ZamparTube" };
}

export default async function FeedPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const userId = await requireUserId();
  const db = getDb();
  const [categories, channels] = await Promise.all([listCategories(db, userId), listChannels(db, userId)]);
  if (channels.length === 0) return <NoChannels />;

  const filters = parseFeedFilters(sp, { categoryIds: categories.map((c) => c.id), channels });
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 200) ?? "";
  const limit = pageLimit(sp.n);

  if (q) {
    const results = await searchVideos(db, userId, q, { limit });
    return (
      <>
        <HomeSearch q={q} filters={filters} />
        <h1 className="mb-5 text-xl font-semibold tracking-tight text-balance">Resultados para “{q}”</h1>
        {results.items.length === 0 ? (
          <p className="mt-10 text-center text-muted">Nada encontrado nos seus canais para “{q}”.</p>
        ) : (
          <>
            <VideoGrid>
              {results.items.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </VideoGrid>
            {canLoadMore(results.hasMore, limit) && (
              <LoadMore basePath="/" params={{ q, ...filterParams(filters) }} current={limit} />
            )}
          </>
        )}
      </>
    );
  }

  const feed = await listFeed(db, userId, { categoryIds: filters.categoryIds, channelIds: filters.channelIds, limit });

  return (
    <>
      <HomeSearch q="" filters={filters} />
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Novidades</h1>
      <FeedFilterBar categories={categories} channels={channels} filters={filters} basePath="/" />
      {feed.items.length > 0 && (
        <VideoGrid>
          {feed.items.map((v) => (
            <VideoCard key={v.id} video={v} onFeed />
          ))}
        </VideoGrid>
      )}
      {canLoadMore(feed.hasMore, limit) ? (
        <LoadMore basePath="/" params={filterParams(filters)} current={limit} />
      ) : (
        <CaughtUp
          hadItems={feed.items.length > 0}
          filtered={filters.categoryIds.length > 0 || filters.channelIds.length > 0}
        />
      )}
    </>
  );
}
