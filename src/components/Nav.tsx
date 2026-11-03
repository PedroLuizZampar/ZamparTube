"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, ListVideo, Search, Tv } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Início", icon: House, match: (p: string) => p === "/" },
  { href: "/channels", label: "Canais", icon: Tv, match: (p: string) => p.startsWith("/channel") },
  { href: "/playlists", label: "Playlists", icon: ListVideo, match: (p: string) => p.startsWith("/playlists") },
  { href: "/search", label: "Busca", icon: Search, match: (p: string) => p.startsWith("/search") },
];

/** Vertical list in the desktop sidebar. */
export function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {ITEMS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-accent/15 text-text" : "text-muted hover:bg-surface hover:text-text"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "text-accent" : ""}`} strokeWidth={active ? 2.25 : 1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Fixed tab bar on phones. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {ITEMS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
              active ? "text-text" : "text-muted"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "text-accent" : ""}`} strokeWidth={active ? 2.25 : 1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
