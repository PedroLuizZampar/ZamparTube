import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Clock, ListVideo, Pencil } from "lucide-react";
import { requireUserId } from "@/lib/auth/require";
import { getDb } from "@/lib/db/client";
import { listPlaylists } from "@/lib/queries/playlists";
import { CreatePlaylistButton, DeletePlaylistButton, PlaylistEditor } from "./PlaylistForms";

export const metadata: Metadata = { title: "Playlists · ZamparTube" };

export default async function PlaylistsPage({ searchParams }: PageProps<"/playlists">) {
  const sp = await searchParams;
  const editingId = Number(Array.isArray(sp.editar) ? sp.editar[0] : sp.editar);
  const lists = await listPlaylists(getDb(), await requireUserId());

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Playlists</h1>
        <CreatePlaylistButton />
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {lists.map((p) => {
          const Icon = p.isWatchLater ? Clock : ListVideo;
          const editing = p.id === editingId;
          return (
            <div key={p.id} className="group flex flex-col gap-3">
              <Link
                href={`/playlists/${p.id}`}
                aria-label={p.name}
                className="relative block aspect-video overflow-hidden rounded-[14px] bg-surface-2"
              >
                {p.imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small same-origin image; next/image adds nothing here
                  <img
                    src={p.imageSrc}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                ) : p.coverThumbnailUrl ? (
                  <Image
                    src={p.coverThumbnailUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-muted">
                    <Icon className="h-8 w-8" strokeWidth={1.5} />
                  </span>
                )}
                <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-xs font-medium tabular-nums">
                  <Icon className="h-3.5 w-3.5" /> {p.count}
                </span>
              </Link>
              {editing ? (
                <PlaylistEditor key={p.id} id={p.id} name={p.name} hasImage={!!p.imageSrc} />
              ) : (
                <div className="flex items-start gap-1">
                  <Link href={`/playlists/${p.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-medium hover:text-accent">{p.name}</span>
                    <span className="text-sm text-muted">{p.count === 1 ? "1 vídeo" : `${p.count} vídeos`}</span>
                  </Link>
                  <Link
                    id={`rename-playlist-${p.id}`}
                    href={`/playlists?editar=${p.id}`}
                    scroll={false}
                    replace
                    aria-label={`Editar ${p.name}`}
                    title="Editar nome e imagem"
                    className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.75} />
                  </Link>
                  {/* "Assistir depois" can be renamed and get a picture, but never be deleted. */}
                  {!p.isWatchLater && <DeletePlaylistButton id={p.id} name={p.name} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
