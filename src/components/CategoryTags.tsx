"use client";

import Link from "next/link";
import * as DM from "@radix-ui/react-dropdown-menu";
import { Check, Plus, X } from "lucide-react";
import { menuContentClass, menuItemClass } from "./ui/menu-styles";

export type CategoryOption = { id: number; name: string; imageSrc: string };

/** Round category picture, or its initial when it has none. */
export function CategoryThumb({ category, size }: { category: CategoryOption; size: number }) {
  return category.imageSrc ? (
    // eslint-disable-next-line @next/next/no-img-element -- small same-origin image; next/image adds nothing here
    <img
      src={category.imageSrc}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-cover"
    />
  ) : (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-border font-semibold uppercase text-muted"
    >
      {category.name.trim().charAt(0) || "?"}
    </span>
  );
}

/**
 * A channel's categories as tags (picture + name, × to remove) plus a "+ Categoria" menu to add more.
 * Always shown, even before any category exists (the menu then points to the categories page).
 */
export function CategoryTags({
  categories,
  selected,
  onToggle,
  disabled = false,
  label,
}: {
  categories: CategoryOption[];
  selected: number[];
  onToggle: (categoryId: number, on: boolean) => void;
  disabled?: boolean;
  /** Who the tags belong to, for screen readers (e.g. the channel name). */
  label: string;
}) {
  const chosen = categories.filter((c) => selected.includes(c.id));
  return (
    <div role="group" aria-label={`Categorias de ${label}`} className="flex flex-wrap items-center gap-1.5">
      {chosen.map((c) => (
        <span
          key={c.id}
          className="flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pl-0.5 pr-1 text-xs font-medium text-text"
        >
          <CategoryThumb category={c} size={20} />
          <span className="max-w-32 truncate">{c.name}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggle(c.id, false)}
            aria-label={`Tirar ${label} de ${c.name}`}
            className="rounded-full p-0.5 text-muted transition-colors hover:bg-border hover:text-text disabled:opacity-50"
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <DM.Root>
        <DM.Trigger
          disabled={disabled}
          className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-50 data-[state=open]:border-accent"
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} /> Categoria
        </DM.Trigger>
        <DM.Portal>
          <DM.Content
            align="start"
            sideOffset={6}
            collisionPadding={16}
            className={`${menuContentClass} max-h-[min(var(--radix-dropdown-menu-content-available-height),18rem)] w-60`}
          >
            {categories.length === 0 ? (
              <DM.Item asChild className={`${menuItemClass} pl-3`}>
                <Link href="/categories">Nenhuma categoria ainda. Criar em Categorias</Link>
              </DM.Item>
            ) : (
              categories.map((c) => (
                <DM.CheckboxItem
                  key={c.id}
                  checked={selected.includes(c.id)}
                  onCheckedChange={(on) => onToggle(c.id, on === true)}
                  onSelect={(e) => e.preventDefault()}
                  className={`${menuItemClass} pl-8`}
                >
                  <DM.ItemIndicator className="absolute left-2.5 inline-flex">
                    <Check className="h-4 w-4 text-accent" strokeWidth={2.5} />
                  </DM.ItemIndicator>
                  <CategoryThumb category={c} size={22} />
                  <span className="truncate">{c.name}</span>
                </DM.CheckboxItem>
              ))
            )}
          </DM.Content>
        </DM.Portal>
      </DM.Root>
    </div>
  );
}
