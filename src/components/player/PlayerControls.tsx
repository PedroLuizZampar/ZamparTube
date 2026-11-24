"use client";

import { useState } from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { Check, Maximize, Minimize, Pause, Play, Volume1, Volume2, VolumeX } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { PLAYBACK_RATES } from "@/lib/player/controls";
import { menuContentClass, menuItemClass } from "../ui/menu-styles";

interface Props {
  playing: boolean;
  current: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  rate: number;
  fullscreen: boolean;
  canFullscreen: boolean;
  /** Where menus render, so they stay visible in fullscreen. */
  portalContainer: HTMLElement | null;
  onToggle: () => void;
  /** While dragging the progress bar. */
  onScrub: (seconds: number) => void;
  /** Drag released, click or keyboard step: the final position. */
  onSeekTo: (seconds: number) => void;
  onVolume: (volume: number) => void;
  onToggleMute: () => void;
  onRate: (rate: number) => void;
  onFullscreen: () => void;
  onMenuOpenChange: (open: boolean) => void;
  /** Shown only when there is a next video to go to. */
  showAutoplay: boolean;
  autoplay: boolean;
  onAutoplay: () => void;
}

const iconButton =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-accent";

/** Keys that move a range input; only these commit a keyboard seek (not Tab or Shift landing on it). */
const SLIDER_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

const rateLabel =(r: number) => `${String(r).replace(".", ",")}x`;

export function PlayerControls(p: Props) {
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);
  const max = Math.max(p.duration, 1);
  const played = Math.min(100, (p.current / max) * 100);
  const VolumeIcon = p.muted || p.volume === 0 ? VolumeX : p.volume < 50 ? Volume1 : Volume2;

  return (
    <div className="flex flex-col gap-1 px-3 pb-2 pt-8 [background:linear-gradient(to_top,rgba(0,0,0,0.75),transparent)]">
      {/* Progress: a native range input (keyboard + screen readers) drawn over our own track. */}
      <div
        className="group/progress relative flex h-4 items-center"
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          setHover({ x: ratio * rect.width, time: ratio * p.duration });
        }}
        onPointerLeave={() => setHover(null)}
      >
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-[height] group-hover/progress:h-1.5">
          <div className="absolute inset-y-0 left-0 bg-white/40" style={{ width: `${p.buffered * 100}%` }} />
          <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${played}%` }} />
        </div>
        <span
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-accent opacity-0 transition-opacity group-hover/progress:opacity-100"
          style={{ left: `${played}%` }}
        />
        {hover && p.duration > 0 && (
          <span
            className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md bg-black/85 px-1.5 py-0.5 text-xs tabular-nums text-white"
            style={{ left: hover.x }}
          >
            {formatDuration(hover.time)}
          </span>
        )}
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={Math.min(p.current, max)}
          onChange={(e) => p.onScrub(Number(e.target.value))}
          onPointerUp={(e) => p.onSeekTo(Number(e.currentTarget.value))}
          onPointerCancel={(e) => p.onSeekTo(Number(e.currentTarget.value))}
          onKeyUp={(e) => SLIDER_KEYS.has(e.key) && p.onSeekTo(Number(e.currentTarget.value))}
          aria-label="Posição do vídeo"
          aria-valuetext={`${formatDuration(p.current)} de ${formatDuration(p.duration)}`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>

      <div className="flex items-center gap-0.5 text-white">
        <button type="button" onClick={p.onToggle} className={iconButton} aria-label={p.playing ? "Pausar (k)" : "Reproduzir (k)"}>
          {p.playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
        </button>

        <div className="group/volume flex items-center">
          <button type="button" onClick={p.onToggleMute} className={iconButton} aria-label={p.muted ? "Ativar som (m)" : "Silenciar (m)"}>
            <VolumeIcon className="h-5 w-5" />
          </button>
          {/* Phones control volume with their buttons; the slider only shows where there is a mouse. */}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={p.muted ? 0 : p.volume}
            onChange={(e) => p.onVolume(Number(e.target.value))}
            aria-label="Volume"
            // Fully invisible (thumb included) until the volume area is hovered or holds keyboard focus:
            // focusing the mute button reveals the slider, which is then the next Tab stop.
            className="invisible hidden h-1 w-0 cursor-pointer opacity-0 accent-[var(--color-accent)] transition-[width,opacity] group-hover/volume:visible group-hover/volume:w-20 group-hover/volume:opacity-100 group-focus-within/volume:visible group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 [@media(hover:hover)]:block"
          />
        </div>

        <span className="ml-2 text-sm tabular-nums text-white/90">
          {formatDuration(p.current)} <span className="text-white/60">/ {formatDuration(p.duration)}</span>
        </span>

        <span className="flex-1" />

        {p.showAutoplay && (
          <button
            type="button"
            role="switch"
            aria-checked={p.autoplay}
            onClick={p.onAutoplay}
            className={`${iconButton} w-auto px-2`}
            aria-label="Reprodução automática"
            title={p.autoplay ? "Reprodução automática ativada" : "Reprodução automática desativada"}
          >
            <span
              className={`relative flex h-4 w-8 items-center rounded-full transition-colors ${
                p.autoplay ? "bg-accent" : "bg-white/30"
              }`}
            >
              <span
                className={`absolute flex h-5 w-5 items-center justify-center rounded-full bg-white text-black shadow transition-transform ${
                  p.autoplay ? "translate-x-3.5" : "-translate-x-0.5"
                }`}
              >
                {p.autoplay ? <Play className="ml-px h-2.5 w-2.5 fill-current" /> : <Pause className="h-2.5 w-2.5 fill-current" />}
              </span>
            </span>
          </button>
        )}

        <DM.Root onOpenChange={p.onMenuOpenChange}>
          <DM.Trigger className={`${iconButton} w-auto px-3 text-sm font-medium tabular-nums`} aria-label={`Velocidade: ${rateLabel(p.rate)}`}>
            {rateLabel(p.rate)}
          </DM.Trigger>
          <DM.Portal container={p.portalContainer}>
            <DM.Content side="top" align="end" sideOffset={8} className={`${menuContentClass} min-w-32`}>
              <DM.Label className="px-3 py-1.5 text-xs font-medium text-muted">Velocidade</DM.Label>
              <DM.RadioGroup value={String(p.rate)} onValueChange={(v) => p.onRate(Number(v))}>
                {PLAYBACK_RATES.map((r) => (
                  <DM.RadioItem key={r} value={String(r)} className={`${menuItemClass} pl-8 tabular-nums`}>
                    <DM.ItemIndicator className="absolute left-2.5 inline-flex">
                      <Check className="h-4 w-4 text-accent" strokeWidth={2.5} />
                    </DM.ItemIndicator>
                    {r === 1 ? "Normal" : rateLabel(r)}
                  </DM.RadioItem>
                ))}
              </DM.RadioGroup>
            </DM.Content>
          </DM.Portal>
        </DM.Root>

        {p.canFullscreen && (
          <button
            type="button"
            onClick={p.onFullscreen}
            className={iconButton}
            aria-label={p.fullscreen ? "Sair da tela cheia (f)" : "Tela cheia (f)"}
          >
            {p.fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
