"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useSyncNow } from "./SyncButton";

/** How far (after damping) the page must be pulled before letting go refreshes. */
const THRESHOLD = 70;
const MAX_PULL = 110;
/** Finger travel is halved, so the pull feels elastic. */
const DAMPING = 0.5;

/** Touches that start here belong to something else (mini player, drag handles, menus). */
const IGNORE = "[data-no-ptr], .touch-none, [role='dialog'], [role='menu'], [role='listbox'], input, textarea";

/**
 * Phones: pull the page down from the very top to fetch new videos ("Atualizar agora"). The browser's own
 * pull-to-refresh is turned off in CSS (and the installed app has none), so this is the only one.
 */
export function PullToRefresh() {
  const { pending, message, run } = useSyncNow();
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);
  const startY = useRef<number | null>(null);
  const runRef = useRef(run);
  const pendingRef = useRef(pending);
  useEffect(() => {
    runRef.current = run;
    pendingRef.current = pending;
  }, [run, pending]);

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const set = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const onStart = (e: TouchEvent) => {
      const target = e.target as Element | null;
      startY.current =
        e.touches.length === 1 && window.scrollY <= 0 && !pendingRef.current && !target?.closest(IGNORE)
          ? e.touches[0].clientY
          : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current) set(0);
        return;
      }
      // Pulling down at the top: this gesture is ours, not a scroll.
      if (e.cancelable) e.preventDefault();
      set(Math.min(MAX_PULL, dy * DAMPING));
    };
    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      const go = pullRef.current >= THRESHOLD;
      set(0);
      if (go) void runRef.current();
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const shown = pending ? 56 : pull;
  const ready = pull >= THRESHOLD;

  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center md:hidden ${
          pull ? "" : "transition-transform duration-200"
        }`}
        style={{ transform: `translateY(${shown - 44}px)`, opacity: shown ? 1 : 0 }}
      >
        <span
          className={`mt-[env(safe-area-inset-top)] flex h-10 w-10 items-center justify-center rounded-full shadow-[0_6px_20px_rgba(0,0,0,0.45)] transition-colors ${
            ready || pending ? "bg-accent text-on-accent" : "bg-surface-2 text-accent"
          }`}
        >
          <RefreshCw
            className={`h-5 w-5 ${pending ? "animate-spin" : ""}`}
            strokeWidth={2}
            style={pending ? undefined : { transform: `rotate(${pull * 3}deg)` }}
          />
        </span>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`fixed inset-x-4 top-16 z-50 mx-auto max-w-sm rounded-lg border border-border bg-surface-2 px-3 py-2 text-center text-sm text-text shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-opacity md:hidden ${
          message ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {message}
      </p>
    </>
  );
}
