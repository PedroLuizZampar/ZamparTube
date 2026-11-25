import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToPlaylistMenu, WatchLaterButton } from "@/components/AddToPlaylistMenu";
import { NowPlaying } from "@/components/player/NowPlaying";
import { QueueButton } from "@/components/QueueButton";
import { QueuePanel } from "@/components/QueuePanel";
import { requireUserId } from "@/lib/auth/require";
import { getDb } from "@/lib/db/client";
import { formatRelative } from "@/lib/format";
import { getPlaylist, listPlaylists, listPlaylistVideos, playlistsContaining } from "@/lib/queries/playlists";
import { loadNowPlaying } from "@/lib/queries/now-playing";
import { listQueue, queueCursor } from "@/lib/queries/queue";
import { getVisibleVideo } from "@/lib/queries/videos";
import { ChannelAvatar } from "@/components/ChannelAvatar";
import { Description, WatchedToggle } from "./WatchControls";

export async function generateMetadata({ params }: PageProps<"/watch/[id]">): Promise<Metadata> {
  const video = await getVisibleVideo(getDb(), await requireUserId(), (await params).id);
  return { title: video ? `${video.title} · ZamparTube` : "ZamparTube" };
}

export default async function WatchPage({ params, searchParams }: PageProps<"/watch/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const userId = await requireUserId();
  const db = getDb();
  const video = await getVisibleVideo(db, userId, id);
  if (!video) notFound();

  const rawList = Number(Array.isArray(sp.list) ? sp.list[0] : sp.list);
  const playlist = Number.isInteger(rawList) && rawList > 0 ? await getPlaylist(db, userId, rawList) : null;
  const listId = playlist ? rawList : null;

  const [playlists, containing, nowPlaying, queue, cursorId, playlistItems] = await Promise.all([
    listPlaylists(db, userId),
    playlistsContaining(db, userId, id),
    loadNowPlaying(db, userId, id, listId),
    listQueue(db, userId),
    queueCursor(db, userId),
    listId ? listPlaylistVideos(db, userId, listId) : null,
  ]);
  if (!nowPlaying) notFound();
  const watchLater = playlists.find((p) => p.isWatchLater);
  const panelItems = playlistItems ?? queue;

  return (
    <>
      <NowPlaying video={nowPlaying} />

      <h1 className="mt-5 text-xl font-semibold leading-snug tracking-tight text-balance md:text-2xl">{video.title}</h1>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <Link href={`/channel/${video.channelId}`} className="flex items-center gap-3">
          <ChannelAvatar src={video.channelAvatarSrc} name={video.channelTitle} size={40} />
          <span>
            <span className="block font-medium hover:text-accent">{video.channelTitle}</span>
            <time dateTime={video.publishedAt.toISOString()} className="block text-sm text-muted">
              {formatRelative(video.publishedAt)}
            </time>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <WatchedToggle videoId={video.id} watched={video.watched} />
          <QueueButton videoId={video.id} queued={queue.some((v) => v.id === video.id)} />
          <WatchLaterButton videoId={video.id} saved={!!watchLater && containing.includes(watchLater.id)} />
          <AddToPlaylistMenu videoId={video.id} playlists={playlists} containing={containing} />
        </div>
      </div>

      {(panelItems.length > 0 || listId) && (
        <QueuePanel
          className="mt-6"
          items={panelItems}
          currentId={video.id}
          cursorId={cursorId}
          mode={listId ? { kind: "playlist", id: listId, name: playlist!.name } : { kind: "queue" }}
        />
      )}

      <Description text={video.description} />
    </>
  );
}
