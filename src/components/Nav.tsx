"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, House, ListOrdered, ListVideo, Tags, Tv } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Início", icon: House, match: (p: string) => p === "/" },
  { href: "/channels", label: "Canais", icon: Tv, match: (p: string) => p.startsWith("/channel") },
  { href: "/categories", label: "Categorias", icon: Tags, match: (p: string) => p.startsWith("/categories") },
  { href: "/playlists", label: "Playlists", icon: ListVideo, match: (p: string) => p.startsWith("/playlists") },
  { href: "/history", label: "Histórico", icon: History, match: (p: string) => p.startsWith("/history") },
];

/** Only in the desktop sidebar: the phone tab bar is full (the queue is reached from Playlists there). */
const QUEUE_ITEM = { href: "/queue", label: "Fila", icon: ListOrdered, match: (p: string) => p.startsWith("/queue") };

/** Vertical list in the desktop sidebar; icons only (label as tooltip) when the sidebar is collapsed. */
export function SideNav({ queueCount = 0, collapsed = false }: { queueCount?: number; collapsed?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {[...ITEMS, QUEUE_ITEM].map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        const badge = href === "/queue" && queueCount > 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? label : undefined}
            title={collapsed ? label : undefined}
            className={`relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors ${
              collapsed ? "justify-center px-0" : "px-3"
            } ${active ? "bg-accent/15 text-text" : "text-muted hover:bg-surface hover:text-text"}`}
          >
            <Icon className={`h-5 w-5 shrink-0 ${active ? "text-accent" : ""}`} strokeWidth={active ? 2.25 : 1.75} />
            {!collapsed && <span className="flex-1">{label}</span>}
            {badge &&
              (collapsed ? (
                <span className="absolute right-1.5 top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 tabular-nums text-on-accent">
                  {queueCount}
                </span>
              ) : (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs tabular-nums text-accent">{queueCount}</span>
              ))}
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
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
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
