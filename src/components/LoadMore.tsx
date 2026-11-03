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
