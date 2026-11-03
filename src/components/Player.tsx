"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveProgressAction } from "@/app/(app)/actions";
import { PROGRESS_SAVE_INTERVAL_MS } from "@/lib/constants";
import { EndScreen } from "./EndScreen";

// Minimal typing for the YouTube IFrame Player API.
interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, number | string>;
      events: { onStateChange: (e: { data: number }) => void };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | undefined;

function loadYouTubeApi(): Promise<YTNamespace> {
  apiPromise ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return apiPromise;
}

interface Props {
  videoId: string;
  durationSeconds: number;
  startAt: number;
  nextHref: string | null;
}

export function Player({ videoId, durationSeconds, startAt, nextHref }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ended, setEnded] = useState(false);
  const [round, setRound] = useState(0);

  const save = useCallback(
    (position?: number) => {
      const p = playerRef.current;
      if (!p) return;
      const duration = p.getDuration() || durationSeconds;
      const current = position ?? p.getCurrentTime();
      if (!Number.isFinite(current) || current <= 0) return;
      void saveProgressAction(videoId, current, duration);
    },
    [videoId, durationSeconds],
  );

  useEffect(() => {
    if (ended) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stopTimer = () => timer && clearInterval(timer);

    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      const mount = document.createElement("div");
      hostRef.current.replaceChildren(mount);
      playerRef.current = new YT.Player(mount, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          rel: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          start: round === 0 ? startAt : 0,
        },
        events: {
          onStateChange: ({ data }) => {
            if (data === YT.PlayerState.PLAYING) {
              stopTimer();
              timer = setInterval(() => save(), PROGRESS_SAVE_INTERVAL_MS);
            } else if (data === YT.PlayerState.PAUSED) {
              stopTimer();
              save();
            } else if (data === YT.PlayerState.ENDED) {
              stopTimer();
              const duration = playerRef.current?.getDuration() || durationSeconds;
              void saveProgressAction(videoId, duration, duration);
              // Replace YouTube's end-of-video suggestions with our own screen.
              playerRef.current?.destroy();
              playerRef.current = null;
              setEnded(true);
            }
          },
        },
      });
    });

    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);

    return () => {
      cancelled = true;
      stopTimer();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      save();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, startAt, durationSeconds, ended, round, save]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      {ended ? (
        <EndScreen
          nextHref={nextHref}
          onReplay={() => {
            setRound((r) => r + 1);
            setEnded(false);
          }}
        />
      ) : (
        <div ref={hostRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
      )}
    </div>
  );
}
