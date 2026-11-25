import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/lib/auth/require";
import { getDb } from "@/lib/db/client";
import { formatRelative } from "@/lib/format";
import { listCategories, listChannels } from "@/lib/queries/channels";
import { ChannelAvatar } from "@/components/ChannelAvatar";
import { AddChannelForm, ChannelCategoryTags, RemoveChannelButton } from "./ChannelForms";

export const metadata: Metadata = { title: "Canais · ZamparTube" };

export default async function ChannelsPage() {
  const userId = await requireUserId();
  const db = getDb();
  const [channels, allCategories] = await Promise.all([listChannels(db, userId), listCategories(db, userId)]);
  const categories = allCategories.map(({ id, name, imageSrc }) => ({ id, name, imageSrc }));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Canais</h1>
      <p className="mt-1 text-muted">Só os vídeos destes canais aparecem no ZamparTube.</p>

      <section className="mt-8 rounded-2xl bg-surface p-5">
        <h2 className="mb-3 font-medium">Adicionar canal</h2>
        <AddChannelForm categories={categories} />
      </section>

      <section className="mt-10">
        <h2 className="mb-2 font-medium">
          Seus canais <span className="text-muted tabular-nums">({channels.length})</span>
        </h2>
        {channels.length === 0 ? (
          <p className="py-6 text-muted">Nenhum canal ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {channels.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-3">
                <Link href={`/channel/${c.id}`} className="shrink-0" aria-label={c.title}>
                  <ChannelAvatar src={c.avatarSrc} name={c.title} size={40} />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Link href={`/channel/${c.id}`} className="min-w-0">
                    <span className="block truncate font-medium hover:text-accent">{c.title}</span>
                    <span className="block truncate text-sm text-muted">
                      {[c.handle, c.lastSyncedAt ? `atualizado ${formatRelative(c.lastSyncedAt)}` : "aguardando atualização"]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                  <ChannelCategoryTags
                    channelId={c.id}
                    title={c.title}
                    categoryIds={c.categoryIds}
                    categories={categories}
                  />
                </div>
                <RemoveChannelButton channelId={c.id} title={c.title} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
