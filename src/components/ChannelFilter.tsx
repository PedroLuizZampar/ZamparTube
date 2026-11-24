"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as DM from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { ChannelAvatar } from "./ChannelAvatar";
import { feedHref, type FeedFilters } from "@/lib/feed-filters";
import { menuContentClass, menuItemClass, menuTriggerClass } from "./ui/menu-styles";

type Channel = { id: string; title: string; avatarSrc: string };

/**
 * Multi-select channel filter. Every toggle updates the page right away (URL replace, no scroll jump)
 * while the menu stays open for more picks.
 */
export function ChannelFilter({
  channels,
  filters,
  basePath = "/",
}: {
  channels: Channel[];
  filters: FeedFilters;
  /** Page the selection navigates to ("/" or "/history"). */
  basePath?: string;
}) {
  const router = useRouter();
  const [, startNav] = useTransition();
  const [selected, setSelected] = useState<string[]>(filters.channelIds);
  const applied = filters.channelIds.join(",");

  // Re-sync when the URL changes the selection (chips, back button). Adjusting state during render.
  const [lastApplied, setLastApplied] = useState(applied);
  if (lastApplied !== applied) {
    setLastApplied(applied);
    setSelected(filters.channelIds);
  }

  if (channels.length === 0) return null;
  const byId = new Map(channels.map((c) => [c.id, c]));
  const picked = selected.map((id) => byId.get(id)).filter((c): c is Channel => !!c);

  const apply = (next: string[]) => {
    setSelected(next);
    startNav(() =>
      router.replace(feedHref({ categoryIds: filters.categoryIds, channelIds: next }, basePath), { scroll: false }),
    );
  };
  const toggle = (id: string, on: boolean) => {
    const next = on ? [...selected, id] : selected.filter((x) => x !== id);
    apply(channels.map((c) => c.id).filter((x) => next.includes(x)));
  };

  return (
    <DM.Root>
      <DM.Trigger className={`${menuTriggerClass} shrink-0`}>
        <span className="flex min-w-0 items-center gap-2">
          {/* Visible text stays part of the accessible name, so screen readers hear the selection too. */}
          <span className="sr-only">Filtrar por canal: </span>
          {picked.length === 0 && <span>Todos os canais</span>}
          {picked.length === 1 && (
            <>
              <ChannelAvatar src={picked[0].avatarSrc} name={picked[0].title} size={20} />
              <span className="max-w-40 truncate">{picked[0].title}</span>
            </>
          )}
          {picked.length > 1 && (
            <>
              <span className="flex -space-x-1.5">
                {picked.slice(0, 3).map((c) => (
                  <span key={c.id} className="rounded-full ring-2 ring-surface-2">
                    <ChannelAvatar src={c.avatarSrc} name={c.title} size={20} />
                  </span>
                ))}
              </span>
              <span>{picked.length} canais</span>
            </>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className={`${menuContentClass} max-h-[min(var(--radix-dropdown-menu-content-available-height),20rem)] w-72 max-w-[calc(100vw-2rem)]`}
        >
          {channels.map((c) => (
            <DM.CheckboxItem
              key={c.id}
              checked={selected.includes(c.id)}
              onCheckedChange={(on) => toggle(c.id, on === true)}
              onSelect={(e) => e.preventDefault()}
              className={`${menuItemClass} pl-2.5`}
            >
              <ChannelAvatar src={c.avatarSrc} name={c.title} size={22} />
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <DM.ItemIndicator className="inline-flex shrink-0">
                <Check className="h-4 w-4 text-accent" strokeWidth={2.5} />
              </DM.ItemIndicator>
            </DM.CheckboxItem>
          ))}
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item
            disabled={selected.length === 0}
            onSelect={(e) => {
              e.preventDefault();
              apply([]);
            }}
            className={`${menuItemClass} pl-2.5 text-muted`}
          >
            Limpar seleção
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
