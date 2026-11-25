import { CategoryFilter } from "./CategoryFilter";
import { ChannelFilter } from "./ChannelFilter";
import type { FeedFilters } from "@/lib/feed-filters";

type Channel = { id: string; title: string; avatarSrc: string; categoryIds: number[] };

/** Category chips + channel menu, shared by the home feed and the history. */
export function FeedFilterBar({
  categories,
  channels,
  filters,
  basePath,
}: {
  categories: Array<{ id: number; name: string; imageSrc?: string; hiddenFromHome?: boolean }>;
  channels: Channel[];
  filters: FeedFilters;
  basePath: string;
}) {
  // With categories selected, the channel menu only lists channels inside them.
  const menuChannels =
    filters.categoryIds.length === 0
      ? channels
      : channels.filter((c) => c.categoryIds.some((id) => filters.categoryIds.includes(id)));
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <CategoryFilter categories={categories} channels={channels} filters={filters} basePath={basePath} />
      <div className="sm:ml-auto">
        <ChannelFilter
          channels={menuChannels.map((c) => ({ id: c.id, title: c.title, avatarSrc: c.avatarSrc }))}
          filters={filters}
          basePath={basePath}
        />
      </div>
    </div>
  );
}
