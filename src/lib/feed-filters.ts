/** Feed filters as carried in the URL: `/?categoria=1,3&canal=UCa,UCb`. Empty lists mean "no filter". */
export interface FeedFilters {
  categoryIds: number[];
  channelIds: string[];
}

type ChannelRef = { id: string; categoryIds: number[] };
type Param = string | string[] | undefined;

function splitParam(p: Param): Set<string> {
  const raw = Array.isArray(p) ? p[0] : p;
  return new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

/** Keeps only channels inside the selected categories (all of them when no category is selected). */
function channelsInCategories(channelIds: string[], categoryIds: number[], channels: ChannelRef[]): string[] {
  if (categoryIds.length === 0) return channelIds;
  const allowed = new Set(channels.filter((c) => c.categoryIds.some((id) => categoryIds.includes(id))).map((c) => c.id));
  return channelIds.filter((id) => allowed.has(id));
}

/** Reads the filters from search params, ignoring unknown, empty and duplicate ids. */
export function parseFeedFilters(
  sp: { categoria?: Param; canal?: Param },
  valid: { categoryIds: number[]; channels: ChannelRef[] },
): FeedFilters {
  const cats = splitParam(sp.categoria);
  const chans = splitParam(sp.canal);
  const categoryIds = valid.categoryIds.filter((id) => cats.has(String(id)));
  const channelIds = valid.channels.filter((c) => chans.has(c.id)).map((c) => c.id);
  return { categoryIds, channelIds: channelsInCategories(channelIds, categoryIds, valid.channels) };
}

/** The URL of `basePath` with these filters (just `basePath` when none). Commas stay readable. */
export function feedHref(f: FeedFilters, basePath = "/"): string {
  const parts: string[] = [];
  if (f.categoryIds.length) parts.push(`categoria=${f.categoryIds.join(",")}`);
  if (f.channelIds.length) parts.push(`canal=${f.channelIds.map(encodeURIComponent).join(",")}`);
  return parts.length ? `${basePath}?${parts.join("&")}` : basePath;
}

/** The filters as plain search params (for "Carregar mais" links). */
export function filterParams(f: FeedFilters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.categoryIds.length) p.categoria = f.categoryIds.join(",");
  if (f.channelIds.length) p.canal = f.channelIds.join(",");
  return p;
}

/** Turns one category chip on or off; channels outside the new category set leave the selection. */
export function toggleCategory(f: FeedFilters, id: number, channels: ChannelRef[]): FeedFilters {
  const categoryIds = f.categoryIds.includes(id)
    ? f.categoryIds.filter((c) => c !== id)
    : [...f.categoryIds, id].sort((a, b) => a - b);
  return { categoryIds, channelIds: channelsInCategories(f.channelIds, categoryIds, channels) };
}
