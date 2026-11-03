import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Play } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { formatDuration } from "@/lib/format";
import { getPlaylist, listPlaylistVideos } from "@/lib/queries/playlists";
import { PlaylistHeaderControls, PlaylistItemControls } from "../PlaylistForms";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: PageProps<"/playlists/[id]">): Promise<Metadata> {
  const id = parseId((await params).id);
  const p = id ? await getPlaylist(getDb(), id) : null;
  return { title: p ? `${p.name} · ZamparTube` : "ZamparTube" };
}

export default async function PlaylistPage({ params }: PageProps<"/playlists/[id]">) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const db = getDb();
  const playlist = await getPlaylist(db, id);
  if (!playlist) notFound();
  const items = await listPlaylistVideos(db, id);
  const next = items.find((v) => !v.watched) ?? items[0];

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{playlist.name}</h1>
            <p className="text-sm text-muted">{items.length === 1 ? "1 vídeo" : `${items.length} vídeos`}</p>
          </div>
          <PlaylistHeaderControls id={playlist.id} name={playlist.name} isWatchLater={playlist.isWatchLater} />
        </div>
        {next && (
          <Link
            href={`/watch/${next.id}?list=${id}`}
            className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <Play className="h-4 w-4 fill-current" /> Tocar a seguir
          </Link>
        )}
      </header>

      {items.length === 0 ? (
        <p className="py-10 text-center text-muted">
          {playlist.isWatchLater
            ? "Nada guardado ainda. Use “Assistir depois” na tela de um vídeo."
            : "Playlist vazia. Adicione vídeos pela tela de cada vídeo."}
        </p>
      ) : (
        <ol className="flex flex-col gap-1">
          {items.map((v, i) => (
            <li key={v.id} className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface">
              <span className="w-5 shrink-0 text-center text-sm tabular-nums text-muted">{i + 1}</span>
              <Link href={`/watch/${v.id}?list=${id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-40">
                  {v.thumbnailUrl && (
                    <Image
                      src={v.thumbnailUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="160px"
                      className={`object-cover ${v.watched ? "opacity-50" : ""}`}
                    />
                  )}
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[11px] font-medium tabular-nums">
                    {formatDuration(v.durationSeconds)}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-medium leading-snug sm:text-base">{v.title}</span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {v.channelTitle}
                    {v.watched && " · assistido"}
                  </span>
                </span>
              </Link>
              <PlaylistItemControls
                playlistId={id}
                videoId={v.id}
                title={v.title}
                isFirst={i === 0}
                isLast={i === items.length - 1}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
