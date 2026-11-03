import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Clock, ListVideo } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { listPlaylists } from "@/lib/queries/playlists";
import { CreatePlaylistForm } from "./PlaylistForms";

export const metadata: Metadata = { title: "Playlists · ZamparTube" };

export default async function PlaylistsPage() {
  const lists = await listPlaylists(getDb());
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Playlists</h1>
        <CreatePlaylistForm />
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {lists.map((p) => {
          const Icon = p.isWatchLater ? Clock : ListVideo;
          return (
            <Link key={p.id} href={`/playlists/${p.id}`} className="group flex flex-col gap-3">
              <span className="relative block aspect-video overflow-hidden rounded-xl bg-surface-2">
                {p.coverThumbnailUrl ? (
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
              </span>
              <span>
                <span className="block font-medium group-hover:text-white">{p.name}</span>
                <span className="text-sm text-muted">
                  {p.count === 1 ? "1 vídeo" : `${p.count} vídeos`}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
