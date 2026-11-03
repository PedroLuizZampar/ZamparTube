import { CategoryFilter } from "@/components/CategoryFilter";
import { CaughtUp, NoChannels } from "@/components/EmptyStates";
import { LoadMore, pageLimit } from "@/components/LoadMore";
import { VideoCard, VideoGrid } from "@/components/VideoCard";
import { getDb } from "@/lib/db/client";
import { listCategories, listChannels } from "@/lib/queries/channels";
import { listFeed } from "@/lib/queries/videos";

export default async function FeedPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const db = getDb();
  const [categories, channels] = await Promise.all([listCategories(db), listChannels(db)]);
  if (channels.length === 0) return <NoChannels />;

  const requested = Number(Array.isArray(sp.categoria) ? sp.categoria[0] : sp.categoria);
  const categoryId = categories.some((c) => c.id === requested) ? requested : undefined;
  const limit = pageLimit(sp.n);
  const feed = await listFeed(db, { categoryId, limit });

  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Novidades</h1>
      <CategoryFilter categories={categories} activeId={categoryId} />
      {feed.items.length > 0 && (
        <VideoGrid>
          {feed.items.map((v) => (
            <VideoCard key={v.id} video={v} onFeed />
          ))}
        </VideoGrid>
      )}
      {feed.hasMore ? (
        <LoadMore basePath="/" params={categoryId ? { categoria: String(categoryId) } : {}} current={limit} />
      ) : (
        <CaughtUp hadItems={feed.items.length > 0} />
      )}
    </>
  );
}
