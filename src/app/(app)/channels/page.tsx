import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { formatRelative } from "@/lib/format";
import { listCategories, listChannels } from "@/lib/queries/channels";
import { ChannelAvatar } from "@/components/ChannelAvatar";
import { AddChannelForm, CategoryRow, ChannelControls, CreateCategoryForm } from "./ChannelForms";

export const metadata: Metadata = { title: "Canais · ZamparTube" };

export default async function ChannelsPage() {
  const db = getDb();
  const [channels, categories] = await Promise.all([listChannels(db), listCategories(db)]);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

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
              <li key={c.id} className="flex items-center gap-3 py-3">
                <Link href={`/channel/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <ChannelAvatar src={c.avatarSrc} name={c.title} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium hover:text-accent">{c.title}</span>
                    <span className="block truncate text-sm text-muted">
                      {[
                        c.handle,
                        c.categoryId ? categoryName.get(c.categoryId) : null,
                        c.lastSyncedAt ? `atualizado ${formatRelative(c.lastSyncedAt)}` : "aguardando atualização",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </Link>
                <ChannelControls channelId={c.id} title={c.title} categoryId={c.categoryId} categories={categories} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 max-w-md">
        <h2 className="font-medium">Categorias</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Use para filtrar o feed por assunto.</p>
        <CreateCategoryForm />
        {categories.length > 0 && (
          <ul className="mt-3 divide-y divide-border">
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
