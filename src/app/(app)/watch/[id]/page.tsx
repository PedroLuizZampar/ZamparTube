import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, SkipForward } from "lucide-react";
import { AddToPlaylistMenu, WatchLaterButton } from "@/components/AddToPlaylistMenu";
import { Player } from "@/components/Player";
import { getDb } from "@/lib/db/client";
import { formatRelative } from "@/lib/format";
import { resumeFrom } from "@/lib/player/progress";
import { getNextInPlaylist, listPlaylists, playlistsContaining } from "@/lib/queries/playlists";
import { getVisibleVideo } from "@/lib/queries/videos";
import { Description, WatchedToggle } from "./WatchControls";

export async function generateMetadata({ params }: PageProps<"/watch/[id]">): Promise<Metadata> {
  const video = await getVisibleVideo(getDb(), (await params).id);
  return { title: video ? `${video.title} · ZamparTube` : "ZamparTube" };
}

export default async function WatchPage({ params, searchParams }: PageProps<"/watch/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const db = getDb();
  const video = await getVisibleVideo(db, id);
  if (!video) notFound();

  const listId = Number(Array.isArray(sp.list) ? sp.list[0] : sp.list);
  const [playlists, containing, nextId] = await Promise.all([
    listPlaylists(db),
    playlistsContaining(db, id),
    Number.isInteger(listId) && listId > 0 ? getNextInPlaylist(db, listId, id) : Promise.resolve(null),
  ]);
  const watchLater = playlists.find((p) => p.isWatchLater);
  const nextHref = nextId ? `/watch/${nextId}?list=${listId}` : null;

  const startAt = resumeFrom({ positionSeconds: video.positionSeconds, watched: video.watched }, video.durationSeconds);

  return (
    <div className="mx-auto max-w-5xl">
      {video.embeddable ? (
        <Player videoId={video.id} durationSeconds={video.durationSeconds} startAt={startAt} nextHref={nextHref} />
      ) : (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          {video.thumbnailUrl && <Image src={video.thumbnailUrl} alt="" fill unoptimized className="object-cover opacity-40" />}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="max-w-md text-pretty">O canal não permite assistir este vídeo fora do YouTube.</p>
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <ExternalLink className="h-4 w-4" /> Abrir no YouTube
            </a>
          </div>
        </div>
      )}

      <h1 className="mt-5 text-xl font-semibold leading-snug tracking-tight text-balance md:text-2xl">{video.title}</h1>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <Link href={`/channel/${video.channelId}`} className="flex items-center gap-3">
          {video.channelAvatarUrl ? (
            <Image src={video.channelAvatarUrl} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-full" />
          ) : (
            <span className="h-10 w-10 rounded-full bg-surface-2" />
          )}
          <span>
            <span className="block font-medium hover:text-white">{video.channelTitle}</span>
            <time dateTime={video.publishedAt.toISOString()} className="block text-sm text-muted">
              {formatRelative(video.publishedAt)}
            </time>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <WatchedToggle videoId={video.id} watched={video.watched} />
          <WatchLaterButton videoId={video.id} saved={!!watchLater && containing.includes(watchLater.id)} />
          <AddToPlaylistMenu videoId={video.id} playlists={playlists} containing={containing} />
        </div>
      </div>
      {nextHref && (
        <div className="mt-4 flex justify-end">
          <Link
            href={nextHref}
            className="flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-text"
          >
            Próximo da playlist <SkipForward className="h-4 w-4" />
          </Link>
        </div>
      )}

      <Description text={video.description} />
    </div>
  );
}
