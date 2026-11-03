import Link from "next/link";
import { PAGE_SIZE } from "@/lib/constants";

/** "Carregar mais": a plain link that asks for a bigger page. No infinite scroll. */
export function LoadMore({ basePath, params, current }: { basePath: string; params: Record<string, string>; current: number }) {
  const qs = new URLSearchParams({ ...params, n: String(current + PAGE_SIZE) });
  return (
    <div className="mt-10 flex justify-center">
      <Link
        href={`${basePath}?${qs}`}
        scroll={false}
        className="rounded-full border border-border px-5 py-2 text-sm font-medium text-text transition-colors hover:border-accent hover:bg-accent/10"
      >
        Carregar mais
      </Link>
    </div>
  );
}

/** Reads ?n= safely: at least PAGE_SIZE, at most 500. */
export function pageLimit(n: string | string[] | undefined): number {
  const value = Number(Array.isArray(n) ? n[0] : n);
  return Number.isInteger(value) && value > PAGE_SIZE ? Math.min(value, 500) : PAGE_SIZE;
}
