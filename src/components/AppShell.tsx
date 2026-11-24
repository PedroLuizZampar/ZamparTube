"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
}: {
  children: ReactNode;
  queueCount: number;
  initialCollapsed: boolean;
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
        <div className="mt-auto">
          <SyncButton collapsed={collapsed} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/95 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/">
          <Logo />
        </Link>
        <SyncButton compact />
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
