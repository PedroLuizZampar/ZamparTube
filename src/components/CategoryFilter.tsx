import Link from "next/link";
import { feedHref, toggleCategory, type FeedFilters } from "@/lib/feed-filters";

/** Multi-select category chips: each chip toggles; "Todos" clears the category selection. */
export function CategoryFilter({
  categories,
  channels,
  filters,
  basePath = "/",
}: {
  categories: Array<{ id: number; name: string; imageSrc?: string }>;
  channels: Array<{ id: string; categoryIds: number[] }>;
  filters: FeedFilters;
  /** Page the chips link to ("/" or "/history"). */
  basePath?: string;
}) {
  if (categories.length === 0) return null;
  const chip = (active: boolean, withImage = false) =>
    `flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pr-3.5 text-sm font-medium transition-colors ${
      withImage ? "pl-1.5" : "pl-3.5"
    } ${active ? "bg-accent/15 text-accent" : "bg-surface-2 text-text hover:bg-border"}`;
  const none = filters.categoryIds.length === 0;
  return (
    <nav aria-label="Categorias" className="-mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      <Link
        href={feedHref({ categoryIds: [], channelIds: filters.channelIds }, basePath)}
        scroll={false}
        className={chip(none)}
        aria-current={none ? "true" : undefined}
      >
        Todos
      </Link>
      {categories.map((c) => {
        const active = filters.categoryIds.includes(c.id);
        return (
          <Link
            key={c.id}
            href={feedHref(toggleCategory(filters, c.id, channels), basePath)}
            scroll={false}
            className={chip(active, !!c.imageSrc)}
            // aria-pressed is not valid on links; aria-current marks the selected chips.
            aria-current={active ? "true" : undefined}
          >
            {c.imageSrc && (
              // eslint-disable-next-line @next/next/no-img-element -- small same-origin image; next/image adds nothing here
              <img src={c.imageSrc} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" />
            )}
            {c.name}
          </Link>
        );
      })}
    </nav>
  );
}
