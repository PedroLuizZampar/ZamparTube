import Image from "next/image";
import { notFound } from "next/navigation";
import { LoadMore } from "@/components/LoadMore";
import { canLoadMore, pageLimit } from "@/lib/paging";
import { VideoCard, VideoGrid } from "@/components/VideoCard";
import { getDb } from "@/lib/db/client";
import { getChannel } from "@/lib/queries/channels";
import { listChannelVideos } from "@/lib/queries/videos";

export default async function ChannelPage({ params, searchParams }: PageProps<"/channel/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const db = getDb();
  const channel = await getChannel(db, id);
  if (!channel) notFound();

  const limit = pageLimit(sp.n);
  const page = await listChannelVideos(db, id, { limit });

  return (
    <>
      <header className="mb-8 flex items-center gap-4">
        {channel.avatarUrl ? (
          <Image src={channel.avatarUrl} alt="" width={64} height={64} unoptimized className="h-16 w-16 rounded-full" />
        ) : (
          <span className="h-16 w-16 rounded-full bg-surface-2" />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{channel.title}</h1>
          {channel.handle && <p className="text-muted">{channel.handle}</p>}
        </div>
      </header>

      {page.items.length === 0 ? (
        <p className="text-muted">Nenhum vídeo deste canal por aqui ainda.</p>
      ) : (
        <VideoGrid>
          {page.items.map((v) => (
            <VideoCard key={v.id} video={v} hideChannel />
          ))}
        </VideoGrid>
      )}
      {canLoadMore(page.hasMore, limit) && <LoadMore basePath={`/channel/${id}`} params={{}} current={limit} />}
    </>
  );
}
