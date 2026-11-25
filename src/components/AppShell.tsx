"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ListOrdered, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AccountMenu, type Account } from "./AccountMenu";
import { Logo, LogoMark } from "./Logo";
import { BottomNav, SideNav } from "./Nav";
import { PullToRefresh } from "./PullToRefresh";
import { SyncButton } from "./SyncButton";
import { SIDEBAR_COOKIE } from "@/lib/ui-prefs";

/** Sidebar (collapsible on desktop), phone header and tab bar around the page. */
export function AppShell({
  children,
  queueCount,
  initialCollapsed,
  account,
}: {
  children: ReactNode;
  queueCount: number;
  initialCollapsed: boolean;
  account: Account;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
    // The page column moved: let anything that tracks positions (the player over its placeholder) re-measure.
    window.dispatchEvent(new Event("resize"));
  }, [collapsed]);

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggle = (
    <button
      type="button"
      onClick={() => setCollapsed((c) => !c)}
      aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      aria-expanded={!collapsed}
      title={collapsed ? "Expandir menu" : "Recolher menu"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-text"
    >
      <ToggleIcon className="h-5 w-5" strokeWidth={1.75} />
    </button>
  );

  return (
    <div className="min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-bg py-5 md:flex ${
          collapsed ? "w-[4.5rem] px-2" : "w-60 px-3"
        }`}
      >
        {collapsed ? (
          <div className="mb-6 flex flex-col items-center gap-3">
            <Link href="/" aria-label="ZamparTube, início">
              <LogoMark />
            </Link>
            {toggle}
          </div>
        ) : (
          <div className="mb-8 flex items-center justify-between gap-2 pl-3">
            <Link href="/">
              <Logo />
            </Link>
            {toggle}
          </div>
        )}
        <SideNav queueCount={queueCount} collapsed={collapsed} />
        <div className="mt-auto flex flex-col gap-3">
          <SyncButton collapsed={collapsed} />
          <AccountMenu account={account} collapsed={collapsed} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/95 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-1.5">
          {/* The tab bar has no room for the queue, so phones reach it from here. */}
          <Link
            href="/queue"
            aria-label={queueCount > 0 ? `Fila (${queueCount})` : "Fila"}
            title="Fila"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-text"
          >
            <ListOrdered className="h-5 w-5" strokeWidth={1.75} />
            {queueCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 tabular-nums text-on-accent">
                {queueCount}
              </span>
            )}
          </Link>
          <SyncButton compact />
          <AccountMenu account={account} compact />
        </div>
      </header>

      <main
        className={`px-4 pb-28 pt-6 md:pb-12 md:pr-8 md:pt-8 ${
          collapsed ? "md:pl-[calc(4.5rem+2rem)]" : "md:pl-[calc(15rem+2rem)]"
        }`}
      >
        {children}
      </main>
      <BottomNav />
      <PullToRefresh />
    </div>
  );
}
