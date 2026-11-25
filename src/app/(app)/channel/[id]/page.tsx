import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { LoadMore } from "@/components/LoadMore";
import { canLoadMore, pageLimit } from "@/lib/paging";
import { VideoCard, VideoGrid } from "@/components/VideoCard";
import { requireUserId } from "@/lib/auth/require";
import { getDb } from "@/lib/db/client";
import { getChannel } from "@/lib/queries/channels";
import { ChannelAvatar } from "@/components/ChannelAvatar";
import { listChannelVideos } from "@/lib/queries/videos";

export default async function ChannelPage({ params, searchParams }: PageProps<"/channel/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const userId = await requireUserId();
  const db = getDb();
  const channel = await getChannel(db, userId, id);
  if (!channel) notFound();

  const limit = pageLimit(sp.n);
  const page = await listChannelVideos(db, userId, id, { limit });

  return (
    <>
      <BackButton fallbackHref="/channels" />
      <header className="mb-8 flex items-center gap-4">
        <ChannelAvatar src={channel.avatarSrc} name={channel.title} size={64} />
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
