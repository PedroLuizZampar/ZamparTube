"use client";

import { useCallback, useLayoutEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp, GripVertical, ListOrdered, ListVideo, Play, Trash2, X } from "lucide-react";
import { clearQueueAction, moveInQueueAction, removeFromQueueAction } from "@/app/(app)/queue/actions";
import { formatDuration } from "@/lib/format";
import type { VideoCardData } from "@/lib/queries/videos";
import { ConfirmDialog } from "./ui/ConfirmDialog";

type Mode = { kind: "queue" } | { kind: "playlist"; id: number; name: string };

interface Props {
  items: VideoCardData[];
  /** The video on screen (highlighted). */
  currentId?: string;
  /** Queue only: the video it stopped at (marked, and "Continuar de onde parou" leads there). */
  cursorId?: string | null;
  /** Hide the panel's own "Continuar" button (the queue page has a bigger one). */
  hideResume?: boolean;
  mode: Mode;
  className?: string;
}

const smallButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-30";

const SLIDE_MS = 220;
const SLIDE_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The queue (reorder by dragging the handle or with ↑/↓, remove, clear) or — when watching from a playlist —
 * that playlist, read-only. Rows slide into their new places instead of jumping.
 */
export function QueuePanel({ items, currentId, cursorId, hideResume = false, mode, className = "" }: Props) {
  const editable = mode.kind === "queue";
  const [order, setOrder] = useState(items);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, start] = useTransition();
  const listRef = useRef<HTMLOListElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  /** Where each row was on screen just before a reorder (slide from there). */
  const before = useRef<Map<string, number> | null>(null);
  const drag = useRef({ from: -1, grabOffset: 0, pointerY: 0 });

  // Server data wins whenever it changes (another tab, a refresh after an action).
  const [seenItems, setSeenItems] = useState(items);
  if (seenItems !== items) {
    setSeenItems(items);
    setOrder(items);
  }

  const snapshot = () => {
    const m = new Map<string, number>();
    rows.current.forEach((el, id) => m.set(id, el.getBoundingClientRect().top));
    before.current = m;
  };

  /** The dragged row follows the pointer; everything is in the list's own coordinates (offsetTop ignores transforms). */
  const placeDragged = useCallback((id: string) => {
    const el = rows.current.get(id);
    const list = listRef.current;
    if (!el || !list) return;
    const y = drag.current.pointerY - list.getBoundingClientRect().top + list.scrollTop - drag.current.grabOffset;
    el.style.transform = `translateY(${y - el.offsetTop}px)`;
  }, []);

  // FLIP: after a reorder, each row starts where it was and slides to its new place.
  useLayoutEffect(() => {
    const from = before.current;
    before.current = null;
    if (from && !prefersReducedMotion()) {
      rows.current.forEach((el, id) => {
        if (id === dragId) return;
        el.getAnimations().forEach((a) => a.cancel());
        const prev = from.get(id);
        const delta = prev === undefined ? 0 : prev - el.getBoundingClientRect().top;
        if (Math.abs(delta) < 1) return;
        el.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], {
          duration: SLIDE_MS,
          easing: SLIDE_EASE,
        });
      });
    }
    if (dragId) placeDragged(dragId);
  }, [order, dragId, placeDragged]);

  const move = (id: string, to: number) => {
    const from = order.findIndex((v) => v.id === id);
    if (from === -1 || to < 0 || to >= order.length || from === to) return;
    snapshot();
    const next = [...order];
    const [v] = next.splice(from, 1);
    next.splice(to, 0, v);
    setOrder(next);
  };
  const commitMove = (id: string, to: number) => start(() => moveInQueueAction(id, to));

  const remove = (id: string) => {
    snapshot();
    setOrder((o) => o.filter((v) => v.id !== id));
    start(() => removeFromQueueAction(id));
  };

  const onHandleDown = (e: React.PointerEvent, id: string) => {
    const el = rows.current.get(id);
    if (!el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    el.getAnimations().forEach((a) => a.cancel());
    drag.current = {
      from: order.findIndex((v) => v.id === id),
      grabOffset: e.clientY - el.getBoundingClientRect().top,
      pointerY: e.clientY,
    };
    setDragId(id);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    const list = listRef.current;
    const el = dragId ? rows.current.get(dragId) : undefined;
    if (!dragId || !list || !el) return;
    drag.current.pointerY = e.clientY;
    placeDragged(dragId);
    // The slot under the dragged row's centre, from the rows' resting places (not where they are mid-slide).
    const centre =
      e.clientY - list.getBoundingClientRect().top + list.scrollTop - drag.current.grabOffset + el.offsetHeight / 2;
    const to = order.findIndex((v) => {
      const r = rows.current.get(v.id);
      return !!r && centre >= r.offsetTop && centre < r.offsetTop + r.offsetHeight;
    });
    if (to !== -1) move(dragId, to);
  };
  const onHandleUp = () => {
    if (!dragId) return;
    const el = rows.current.get(dragId);
    if (el) {
      const settled = el.style.transform;
      el.style.transform = "";
      if (settled && !prefersReducedMotion())
        el.animate([{ transform: settled }, { transform: "translateY(0)" }], { duration: 160, easing: SLIDE_EASE });
    }
    const to = order.findIndex((v) => v.id === dragId);
    if (to !== drag.current.from) commitMove(dragId, to);
    setDragId(null);
  };

  const Icon = editable ? ListOrdered : ListVideo;
  const title = mode.kind === "queue" ? "Fila" : mode.name;
  const showResume =
    editable && !hideResume && !!cursorId && cursorId !== currentId && order.some((v) => v.id === cursorId);

  return (
    <section className={`rounded-[14px] bg-surface p-3 ${className}`} aria-label={title}>
      <header className="mb-2 flex flex-wrap items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-accent" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {mode.kind === "playlist" ? (
            <Link href={`/playlists/${mode.id}`} className="hover:text-accent">
              {title}
            </Link>
          ) : (
            title
          )}
          <span className="ml-2 font-normal text-muted">{order.length}</span>
        </h2>
        {showResume && (
          <Link
            href={`/watch/${cursorId}`}
            scroll={false}
            className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
          >
            <Play className="h-3.5 w-3.5 fill-current" /> Continuar de onde parou
          </Link>
        )}
        {editable && order.length > 0 && (
          <ConfirmDialog
            trigger={
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <Trash2 className="h-3.5 w-3.5" /> Limpar fila
              </button>
            }
            title="Limpar a fila?"
            description="Todos os vídeos saem da fila. Eles continuam no feed e nas playlists."
            confirmLabel="Limpar"
            destructive
            onConfirm={() => {
              setOrder([]);
              start(() => clearQueueAction());
            }}
          />
        )}
      </header>

      {order.length === 0 ? (
        <p className="px-1 py-4 text-center text-sm text-muted">
          {editable ? "A fila está vazia. Use “Adicionar à fila” nos cards ou na tela de um vídeo." : "Playlist vazia."}
        </p>
      ) : (
        <ol ref={listRef} className="relative flex max-h-[26rem] flex-col gap-0.5 overflow-y-auto">
          {order.map((v, i) => {
            const current = v.id === currentId;
            const stoppedHere = editable && !current && v.id === cursorId;
            const progress =
              !v.watched && v.durationSeconds > 0 && v.positionSeconds > 0
                ? Math.min(100, (v.positionSeconds / v.durationSeconds) * 100)
                : 0;
            const dragging = dragId === v.id;
            return (
              <li
                key={v.id}
                ref={(el) => {
                  if (el) rows.current.set(v.id, el);
                  else rows.current.delete(v.id);
                }}
                className={`group relative flex items-center gap-2 rounded-lg p-1.5 transition-[background-color,box-shadow] ${
                  dragging
                    ? "z-10 bg-surface-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-1 ring-accent"
                    : current
                      ? "bg-accent/10"
                      : "hover:bg-surface-2"
                }`}
              >
                {editable ? (
                  <button
                    type="button"
                    aria-label={`Arrastar “${v.title}”`}
                    className="flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing"
                    onPointerDown={(e) => onHandleDown(e, v.id)}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onPointerCancel={onHandleUp}
                    tabIndex={-1}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted">{i + 1}</span>
                )}
                <Link
                  href={mode.kind === "playlist" ? `/watch/${v.id}?list=${mode.id}` : `/watch/${v.id}`}
                  scroll={false}
                  aria-current={current ? "true" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-surface-2">
                    {v.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- small list thumbnail
                      <img
                        src={v.thumbnailUrl}
                        alt=""
                        className={`h-full w-full object-cover ${v.watched ? "opacity-50" : ""}`}
                        loading="lazy"
                      />
                    )}
                    {v.watched && (
                      <span className="absolute left-1 top-1 rounded bg-black/80 p-0.5" title="Assistido">
                        <Check className="h-3 w-3 text-accent" strokeWidth={2.5} />
                      </span>
                    )}
                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[10px] font-medium tabular-nums text-white">
                      {formatDuration(v.durationSeconds)}
                    </span>
                    {progress > 0 && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/20">
                        <span className="block h-full bg-accent" style={{ width: `${progress}%` }} />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className={`line-clamp-2 text-sm font-medium leading-snug ${current ? "text-accent" : ""}`}>
                      {v.title}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {stoppedHere ? <span className="font-medium text-accent">Parou aqui · </span> : null}
                      {v.channelTitle}
                    </span>
                  </span>
                </Link>
                {editable && (
                  <span className="flex shrink-0 items-center opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                    <button
                      type="button"
                      className={smallButton}
                      disabled={i === 0}
                      aria-label="Mover para cima"
                      onClick={() => {
                        move(v.id, i - 1);
                        commitMove(v.id, i - 1);
                      }}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={smallButton}
                      disabled={i === order.length - 1}
                      aria-label="Mover para baixo"
                      onClick={() => {
                        move(v.id, i + 1);
                        commitMove(v.id, i + 1);
                      }}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button type="button" className={smallButton} aria-label="Remover da fila" onClick={() => remove(v.id)}>
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
