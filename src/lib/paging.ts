import { PAGE_SIZE } from "@/lib/constants";

/** "Carregar mais" grows the page up to this many videos. */
export const MAX_PAGE_LIMIT = 2000;

/** Reads ?n= safely: at least PAGE_SIZE, at most MAX_PAGE_LIMIT. */
export function pageLimit(n: string | string[] | undefined): number {
  const value = Number(Array.isArray(n) ? n[0] : n);
  return Number.isInteger(value) && value > PAGE_SIZE ? Math.min(value, MAX_PAGE_LIMIT) : PAGE_SIZE;
}

/** The button only shows when it would actually load something. */
export function canLoadMore(hasMore: boolean, limit: number): boolean {
  return hasMore && limit < MAX_PAGE_LIMIT;
}
