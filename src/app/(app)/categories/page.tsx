import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Tags } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { listCategories } from "@/lib/queries/channels";
import { CategoryEditor, CreateCategoryButton, DeleteCategoryButton } from "./CategoryForms";

export const metadata: Metadata = { title: "Categorias · ZamparTube" };

export default async function CategoriesPage({ searchParams }: PageProps<"/categories">) {
  const sp = await searchParams;
  const editingId = Number(Array.isArray(sp.editar) ? sp.editar[0] : sp.editar);
  const categories = await listCategories(getDb());

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
        <CreateCategoryButton />
      </div>
      <p className="mb-8 text-muted">Agrupe seus canais por assunto para filtrar o feed e o histórico.</p>

      {categories.length === 0 ? (
        <p className="py-10 text-center text-muted">Nenhuma categoria ainda. Clique em “Criar” para começar.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {categories.map((c) => (
            <div key={c.id} className="flex flex-col gap-3">
              <span className="relative block aspect-square overflow-hidden rounded-[14px] bg-surface-2">
                {c.imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small same-origin image; next/image adds nothing here
                  <img src={c.imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-muted">
                    <Tags className="h-8 w-8" strokeWidth={1.5} />
                  </span>
                )}
              </span>
              {c.id === editingId ? (
                <CategoryEditor key={c.id} id={c.id} name={c.name} hasImage={!!c.imageSrc} />
              ) : (
                <div className="flex items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="text-sm text-muted">
                      {c.channelCount === 1 ? "1 canal" : `${c.channelCount} canais`}
                    </span>
                  </div>
                  <Link
                    id={`rename-category-${c.id}`}
                    href={`/categories?editar=${c.id}`}
                    scroll={false}
                    replace
                    aria-label={`Editar ${c.name}`}
                    title="Editar nome e imagem"
                    className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.75} />
                  </Link>
                  <DeleteCategoryButton id={c.id} name={c.name} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
