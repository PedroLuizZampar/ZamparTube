"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { Check, Clock, EyeOff, ListPlus, ListStart, MoreVertical, X } from "lucide-react";
import { dismissAction, removeFromHistoryAction } from "@/app/(app)/actions";
import { setWatchLaterAction } from "@/app/(app)/playlists/actions";
import { enqueueAction } from "@/app/(app)/queue/actions";
import { menuContentClass, menuItemClass } from "./ui/menu-styles";
import { useWatchLaterName } from "./WatchLaterName";

interface Props {
  videoId: string;
  title: string;
  savedForLater: boolean;
  /** "Dispensar do feed" (feed cards only). */
  canDismiss: boolean;
  /** "Remover do histórico" (history cards only). */
  canRemoveFromHistory?: boolean;
}

// No text colour or padding here: Tailwind orders same-property utilities itself, so colours are chosen per state below.
const iconButton = "rounded-lg transition-[opacity,color,background-color] hover:bg-surface disabled:opacity-50";
/** Over the thumbnail: dark chips, revealed on card hover or keyboard focus. */
const overlayButton =
  "rounded-lg bg-black/75 p-1.5 backdrop-blur-sm transition-[opacity,color,background-color] hover:bg-black/90 disabled:opacity-50";
const revealOnHover = "text-white/85 hover:text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100";

/**
 * Quick actions on a video card. Wide screens with hover get icon buttons over the thumbnail's corner (so they never
 * squeeze the title); small screens and touch devices get a ⋮ button on the title's line with the same actions in a
 * menu. Small screens always get the ⋮: some phones report hover, and a hover-only overlay is unusable there.
 * The card must be `relative`: the hover icons are placed against it.
 */
export function CardActions({ videoId, title, savedForLater, canDismiss, canRemoveFromHistory = false }: Props) {
  const [saved, setSaved] = useOptimistic(savedForLater);
  const [pending, start] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const toggleSaved = () =>
    start(async () => {
      setSaved(!saved);
      await setWatchLaterAction(videoId, !saved);
    });

  /** The card is about to disappear: move keyboard focus to the next card (or the previous one) first. */
  const removeCard = (action: () => Promise<void>) => {
    const card = rootRef.current?.closest("article");
    const neighbour = (card?.nextElementSibling ?? card?.previousElementSibling) as HTMLElement | null;
    start(async () => {
      await action();
      neighbour?.querySelector<HTMLElement>("a")?.focus();
    });
  };
  const dismiss = () => removeCard(() => dismissAction(videoId));
  const removeFromHistory = () => removeCard(() => removeFromHistoryAction(videoId));

  /** Brief "done" tick after adding to the queue (cards don't track queue membership). */
  const [queued, setQueued] = useState<"end" | "next" | null>(null);
  const addToQueue = (mode: "end" | "next") =>
    start(async () => {
      await enqueueAction([videoId], mode);
      setQueued(mode);
      setTimeout(() => setQueued((q) => (q === mode ? null : q)), 1500);
    });

  const listName = useWatchLaterName();
  const saveLabel = saved ? `Remover de “${listName}”` : `Salvar em “${listName}”`;

  return (
    <div ref={rootRef} className="flex shrink-0 items-start">
      {/* Touch devices: the saved state is visible on the card itself, not only inside the ⋮ menu. */}
      {saved && (
        <span className="p-2.5 text-accent md:[@media(hover:hover)]:hidden" title={`Salvo em “${listName}”`}>
          <Clock className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          <span className="sr-only">Salvo em “{listName}”</span>
        </span>
      )}
      {/* Hover devices: icons over the thumbnail, revealed on card hover or keyboard focus. Saved state stays visible. */}
      <div className="absolute right-2 top-2 z-10 hidden gap-1 md:[@media(hover:hover)]:flex">
        <button
          type="button"
          onClick={toggleSaved}
          aria-pressed={saved}
          title={saveLabel}
          aria-label={`${saveLabel}: "${title}"`}
          className={`${overlayButton} ${saved ? "text-accent" : revealOnHover}`}
        >
          <Clock className="h-4 w-4" strokeWidth={saved ? 2.5 : 1.75} />
        </button>
        <button
          type="button"
          onClick={() => addToQueue("end")}
          disabled={pending}
          title="Adicionar à fila"
          aria-label={`Adicionar "${title}" à fila`}
          className={`${overlayButton} ${queued === "end" ? "text-accent" : revealOnHover}`}
        >
          {queued === "end" ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <ListPlus className="h-4 w-4" strokeWidth={1.75} />}
        </button>
        <button
          type="button"
          onClick={() => addToQueue("next")}
          disabled={pending}
          title="Tocar a seguir"
          aria-label={`Tocar "${title}" a seguir`}
          className={`${overlayButton} ${queued === "next" ? "text-accent" : revealOnHover}`}
        >
          {queued === "next" ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <ListStart className="h-4 w-4" strokeWidth={1.75} />}
        </button>
        {canDismiss && (
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            title="Dispensar do feed"
            aria-label={`Dispensar "${title}" do feed`}
            className={`${overlayButton} ${revealOnHover}`}
          >
            <EyeOff className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
        {canRemoveFromHistory && (
          <button
            type="button"
            onClick={removeFromHistory}
            disabled={pending}
            title="Remover do histórico"
            aria-label={`Remover "${title}" do histórico`}
            className={`${overlayButton} ${revealOnHover}`}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Small screens and touch devices: ⋮ menu. */}
      <div className="md:[@media(hover:hover)]:hidden">
        {/* Modal (default): a tap outside only closes the menu instead of also opening the video underneath. */}
        <DM.Root>
          <DM.Trigger
            aria-label={`Ações para "${title}"`}
            className={`${iconButton} -mr-2 p-2.5 text-muted data-[state=open]:bg-surface`}
          >
            <MoreVertical className="h-5 w-5" strokeWidth={1.75} />
          </DM.Trigger>
          <DM.Portal>
            <DM.Content align="end" sideOffset={4} collisionPadding={16} className={`${menuContentClass} min-w-60`}>
              <DM.Item onSelect={toggleSaved} className={`${menuItemClass} pl-3`}>
                <Clock className={`h-4 w-4 ${saved ? "text-accent" : "text-muted"}`} />
                {saveLabel}
              </DM.Item>
              <DM.Item onSelect={() => addToQueue("end")} className={`${menuItemClass} pl-3`}>
                <ListPlus className="h-4 w-4 text-muted" />
                Adicionar à fila
              </DM.Item>
              <DM.Item onSelect={() => addToQueue("next")} className={`${menuItemClass} pl-3`}>
                <ListStart className="h-4 w-4 text-muted" />
                Tocar a seguir
              </DM.Item>
              {canDismiss && (
                <DM.Item onSelect={dismiss} className={`${menuItemClass} pl-3`}>
                  <EyeOff className="h-4 w-4 text-muted" />
                  Dispensar do feed
                </DM.Item>
              )}
              {canRemoveFromHistory && (
                <DM.Item onSelect={removeFromHistory} className={`${menuItemClass} pl-3`}>
                  <X className="h-4 w-4 text-muted" />
                  Remover do histórico
                </DM.Item>
              )}
            </DM.Content>
          </DM.Portal>
        </DM.Root>
      </div>
    </div>
  );
}
