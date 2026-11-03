"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
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
      events: {
        onStateChange: (e: { data: number }) => void;
        onError: (e: { data: number }) => void;
      };
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
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YouTube player failed to load"));
    document.head.appendChild(script);
  }).catch((e) => {
    apiPromise = undefined; // allow a retry on the next mount
    throw e;
  });
  return apiPromise;
}

interface Props {
  videoId: string;
  durationSeconds: number;
  startAt: number;
  nextHref: string | null;
}

/** Mount with `key={videoId}`: the start position is read once, so page refreshes never restart playback. */
export function Player({ videoId, durationSeconds, startAt, nextHref }: Props) {
  const router = useRouter();
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const durationRef = useRef(durationSeconds);
  const [initialStart] = useState(startAt);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    durationRef.current = durationSeconds;
  }, [durationSeconds]);

  useEffect(() => {
    if (ended || failed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stopTimer = () => timer && clearInterval(timer);

    const save = () => {
      const p = playerRef.current;
      if (!p) return;
      const duration = p.getDuration() || durationRef.current;
      const current = p.getCurrentTime();
      if (!Number.isFinite(current) || current <= 0) return;
      void saveProgressAction(videoId, current, duration);
    };

    loadYouTubeApi()
      .then((YT) => {
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
            start: round === 0 ? initialStart : 0,
          },
          events: {
            onStateChange: ({ data }) => {
              if (data === YT.PlayerState.PLAYING) {
                stopTimer();
                timer = setInterval(save, PROGRESS_SAVE_INTERVAL_MS);
              } else if (data === YT.PlayerState.PAUSED) {
                stopTimer();
                save();
              } else if (data === YT.PlayerState.ENDED) {
                stopTimer();
                const duration = playerRef.current?.getDuration() || durationRef.current;
                // Replace YouTube's end-of-video suggestions with our own screen.
                playerRef.current?.destroy();
                playerRef.current = null;
                setEnded(true);
                void saveProgressAction(videoId, duration, duration).then(() => router.refresh());
              }
            },
            // 100: removed/private, 101/150: embedding disabled by the owner.
            onError: () => {
              stopTimer();
              playerRef.current?.destroy();
              playerRef.current = null;
              setFailed(true);
            },
          },
        });
      })
      .catch(() => !cancelled && setFailed(true));

    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);

    return () => {
      cancelled = true;
      stopTimer();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
      save();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, initialStart, ended, failed, round, router]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[14px] bg-black">
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
          <p className="max-w-md text-pretty">Não foi possível tocar este vídeo aqui.</p>
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            <ExternalLink className="h-4 w-4" /> Abrir no YouTube
          </a>
        </div>
      ) : ended ? (
        <EndScreen
          nextHref={nextHref}
          onReplay={() => {
            setRound((r) => r + 1);
            setEnded(false);
          }}
        />
      ) : (
        <div ref={hostRef} className="absolute inset-0" />
      )}
    </div>
  );
}
