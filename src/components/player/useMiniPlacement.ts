"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";

/** Where the mini player sits: distances from the window's bottom-right corner, and its width (16:9). */
export interface MiniPlacement {
  right: number;
  bottom: number;
  width: number;
}

const STORAGE_KEY = "zt.mini";
export const MINI_MIN_WIDTH = 200;
export const MINI_MAX_WIDTH = 720;
const EDGE = 8;
/** The phone tab bar is this tall: the mini player starts above it. */
const PHONE_NAV = 72;
/** Pointer travel before a press becomes a drag (below it, it stays a click/tap on the player). */
const DRAG_THRESHOLD = 6;

function defaultPlacement(vw: number): MiniPlacement {
  return vw < 768 ? { right: 12, bottom: PHONE_NAV + 12, width: 240 } : { right: 20, bottom: 20, width: 352 };
}

/** Keeps the whole mini player inside the window. */
export function clampPlacement(p: MiniPlacement, vw: number, vh: number): MiniPlacement {
  const width = Math.round(Math.min(Math.max(p.width, MINI_MIN_WIDTH), Math.min(MINI_MAX_WIDTH, vw - 2 * EDGE)));
  const height = (width * 9) / 16;
  return {
    width,
    right: Math.round(Math.min(Math.max(p.right, EDGE), Math.max(EDGE, vw - width - EDGE))),
    bottom: Math.round(Math.min(Math.max(p.bottom, EDGE), Math.max(EDGE, vh - height - EDGE))),
  };
}

function load(): MiniPlacement | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as MiniPlacement | null;
    if (raw && [raw.right, raw.bottom, raw.width].every((n) => typeof n === "number" && Number.isFinite(n))) return raw;
  } catch {
    /* storage blocked or bad JSON */
  }
  return null;
}

function save(p: MiniPlacement) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage blocked */
  }
}

type Gesture = {
  kind: "move" | "resize";
  pointerId: number;
  x: number;
  y: number;
  start: MiniPlacement;
  active: boolean;
};

/**
 * Drag the mini player anywhere (press and move past a few pixels; a plain click still reaches the player) and
 * resize it from its top-left corner. The placement is remembered per browser.
 */
export function useMiniPlacement() {
  const [placement, setPlacement] = useState<MiniPlacement | null>(null);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  /** A drag just ended: swallow the click it would otherwise produce on the player. */
  const swallowClick = useRef(false);

  const current = useCallback((): MiniPlacement => {
    const vw = window.innerWidth;
    return clampPlacement(placement ?? load() ?? defaultPlacement(vw), vw, window.innerHeight);
  }, [placement]);

  // Stay inside the window when it gets smaller (rotation, resize).
  useEffect(() => {
    const onResize = () =>
      setPlacement((p) => (p ? clampPlacement(p, window.innerWidth, window.innerHeight) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /**
   * Follows the pointer on the whole window (a quick drag leaves the mini player at once). The release of a real
   * drag is stopped before it reaches the page, so it never also counts as a tap on the player.
   */
  const begin = (kind: Gesture["kind"], e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const g: Gesture = { kind, pointerId: e.pointerId, x: e.clientX, y: e.clientY, start: current(), active: false };
    gesture.current = g;
    let latest = g.start;
    const prevUserSelect = document.body.style.userSelect;

    const onMove = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== g.pointerId) return;
      const dx = ev.clientX - g.x;
      const dy = ev.clientY - g.y;
      if (!g.active) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        g.active = true;
        document.body.style.userSelect = "none";
        window.getSelection()?.removeAllRanges();
        setDragging(true);
      }
      ev.preventDefault();
      latest = clampPlacement(
        g.kind === "move"
          ? { ...g.start, right: g.start.right - dx, bottom: g.start.bottom - dy }
          : // The bottom-right corner stays put; the top-left corner follows the pointer.
            { ...g.start, width: g.start.width - Math.max(dx, (dy * 16) / 9) },
        window.innerWidth,
        window.innerHeight,
      );
      setPlacement(latest);
    };
    const onUp = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== g.pointerId) return;
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      gesture.current = null;
      if (!g.active) return;
      ev.stopPropagation();
      // The click that follows this release (if any) comes right away; never swallow a later, real one.
      swallowClick.current = true;
      setTimeout(() => (swallowClick.current = false), 0);
      document.body.style.userSelect = prevUserSelect;
      setDragging(false);
      save(latest);
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
  };

  const onPointerDownCapture = (e: PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("[data-mini-resize]")) return;
    begin("move", e);
  };

  const onClickCapture = (e: MouseEvent) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  const p = placement ?? (typeof window === "undefined" ? null : current());
  const style: CSSProperties | undefined = p ? { right: p.right, bottom: p.bottom, width: p.width } : undefined;

  return {
    style,
    dragging,
    frameProps: {
      onPointerDownCapture,
      onClickCapture,
    },
    resizeHandleProps: {
      "data-mini-resize": true,
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        e.stopPropagation();
        begin("resize", e);
      },
    },
  };
}
