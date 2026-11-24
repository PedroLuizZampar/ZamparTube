"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Maximize2, Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import { saveProgressAction } from "@/app/(app)/actions";
import { PROGRESS_SAVE_INTERVAL_MS } from "@/lib/constants";
import { clampSeek, isTypingTarget, shortcutFor, tapZone } from "@/lib/player/controls";
import { AUTOPLAY_COUNTDOWN_S, EndScreen } from "./EndScreen";
import { NavButtons } from "./player/NavButtons";
import type { CurrentVideo, NavDirection } from "./player/NowPlaying";
import { PlayerControls } from "./player/PlayerControls";
import { loadYouTubeApi, type YTPlayer } from "./player/youtube-api";

interface Props {
  video: CurrentVideo;
  onNavigate: (dir: NavDirection) => void;
  /** The video started playing for the first time since it was loaded. */
  onStarted: (videoId: string) => void;
  /** Mini player (outside the watch page): small controls, no keyboard shortcuts. */
  compact?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
}

type Status = "loading" | "unstarted" | "playing" | "paused" | "buffering";

/**
 * YouTube still draws its title bar (top) and logo (bottom corner) over the video, even without controls.
 * The frame is the 16:9 box that fits the player, made taller by this much on each side and centred: the video
 * (bound by the frame's width) keeps exactly that box, while those strips fall outside the player and are clipped.
 */
const FRAME_CROP_PX = 72;

const HIDE_CONTROLS_MS = 1000;
/**
 * After playback starts YouTube keeps its own ⏸ in the middle of its frame for about this long (we cannot hide
 * it); our controls stay up as long, so both go away together.
 */
const YT_CHROME_MS = 3000;
const DOUBLE_TAP_MS = 300;
const UI_TICK_MS = 250;
/** If "play" did nothing by then (iPhone needs a tap inside YouTube's frame), let taps reach the frame. */
const PLAY_FALLBACK_MS = 1500;
/**
 * When playback starts, YouTube draws its own spinner and a ⏸ in the middle of its frame (we cannot style inside
 * it). The poster stays over the picture until they are gone, then fades out.
 */
const YT_OVERLAY_MS = 750;

// Per-viewer conveniences: remembered between videos, harmless if storage is unavailable.
function readPref(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    const v = Number(raw);
    return raw !== null && Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* private mode or blocked storage */
  }
}

/** Captions stay off, whatever the viewer's YouTube account says. */
function hideCaptions(p: YTPlayer) {
  try {
    p.unloadModule?.("captions");
    p.unloadModule?.("cc");
  } catch {
    /* module API missing in this player build */
  }
}

/**
 * Our own video player: the YouTube IFrame player only draws the picture (its controls and keyboard are off,
 * and a layer of ours covers it); play, seek, volume, speed and fullscreen are ours.
 * It is created once and stays mounted while the app layout lives (big on the watch page, mini elsewhere): a new `video` is loaded into the same
 * YouTube player, so fullscreen survives moving through the queue.
 */
export function Player({ video, onNavigate, onStarted, compact = false, onExpand, onClose }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  /** YouTube only adds the player's methods once it is ready; never call them before. */
  const readyRef = useRef(false);
  const videoRef = useRef(video);
  /** The video id actually loaded in the YouTube player. */
  const loadedIdRef = useRef<string | null>(null);
  const startedIdRef = useRef<string | null>(null);
  const endedRef = useRef(false);
  const scrubbingRef = useRef(false);
  const onStartedRef = useRef(onStarted);
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    videoRef.current = video;
    onStartedRef.current = onStarted;
    onNavigateRef.current = onNavigate;
  }, [video, onStarted, onNavigate]);

  const [status, setStatus] = useState<Status>("loading");
  const [current, setCurrent] = useState(video.startAt);
  const [duration, setDuration] = useState(video.durationSeconds);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [autoplay, setAutoplay] = useState(true);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  /** Browsers without element fullscreen (iPhone) get the player stretched over the whole page instead. */
  const [pageFullscreen, setPageFullscreen] = useState(false);
  const fullscreen = nativeFullscreen || pageFullscreen;
  // Menus render inside the player so they stay visible in fullscreen; needs the element as state.
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const setContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    setContainerEl(el);
  }, []);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [flash, setFlash] = useState<{ dir: "back" | "forward"; key: number } | null>(null);
  /** Fallback when play() is ignored (iPhone): our layers step aside so the next tap reaches YouTube's frame. */
  const [tapThrough, setTapThrough] = useState(false);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Playing long enough for YouTube's own centre overlay to be gone: the poster may fade out. */
  const [revealed, setRevealed] = useState(false);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Until when YouTube's own centre ⏸ is up (see YT_CHROME_MS). */
  const syncUntil = useRef(0);
  const playFallbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTap = useRef<{ time: number; zone: string } | null>(null);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pointerTypeRef = useRef("mouse");
  const saveTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const uiTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const playing = status === "playing" || status === "buffering";
  // Mirrors for timers and event handlers that outlive a render.
  const statusRef = useRef(status);
  const controlsVisibleRef = useRef(controlsVisible);
  useEffect(() => {
    statusRef.current = status;
    controlsVisibleRef.current = controlsVisible;
  }, [status, controlsVisible]);

  useEffect(() => {
    if (status !== "playing" || revealed) return;
    const t = setTimeout(() => setRevealed(true), YT_OVERLAY_MS);
    return () => clearTimeout(t);
  }, [status, revealed]);

  // ---- controls visibility -------------------------------------------------------------------
  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    const wait = Math.max(HIDE_CONTROLS_MS, syncUntil.current - Date.now());
    hideTimer.current = setTimeout(() => setControlsVisible(false), wait);
  }, []);
  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
      clearTimeout(playFallbackTimer.current);
      clearTimeout(singleTapTimer.current);
    },
    [],
  );
  const showChrome = !playing || controlsVisible || menuOpen;

  // ---- progress and UI timers ------------------------------------------------------------------
  const ready = useCallback(() => (readyRef.current ? playerRef.current : null), []);

  const stopTimers = useCallback(() => {
    clearInterval(saveTimer.current);
    clearInterval(uiTimer.current);
  }, []);

  /** Saves where the loaded video is (not after it ended: that save already marked it watched). */
  const save = useCallback(() => {
    const p = ready();
    const id = loadedIdRef.current;
    if (!p || !id || endedRef.current) return;
    const d = p.getDuration() || videoRef.current.durationSeconds;
    const t = p.getCurrentTime();
    if (!Number.isFinite(t) || t <= 0) return;
    saveProgressAction(id, t, d).catch(() => {});
  }, [ready]);

  const tick = useCallback(() => {
    const p = ready();
    if (!p) return;
    if (!scrubbingRef.current) setCurrent(p.getCurrentTime());
    setBuffered(p.getVideoLoadedFraction() || 0);
    const d = p.getDuration();
    if (d > 0) setDuration(d);
  }, [ready]);

  // ---- player commands -----------------------------------------------------------------------
  const toggle = useCallback(() => {
    const p = ready();
    if (!p) return;
    if (statusRef.current === "playing" || statusRef.current === "buffering") {
      p.pauseVideo();
      return;
    }
    p.playVideo();
    clearTimeout(playFallbackTimer.current);
    if (statusRef.current === "unstarted") {
      playFallbackTimer.current = setTimeout(() => {
        if (statusRef.current === "unstarted") setTapThrough(true);
      }, PLAY_FALLBACK_MS);
    }
  }, [ready]);

  /** Final seek (click, drag end, keyboard): lets YouTube fetch ahead. */
  const seekTo = useCallback(
    (seconds: number) => {
      scrubbingRef.current = false;
      const p = ready();
      if (!p) return;
      p.seekTo(seconds, true);
      setCurrent(seconds);
    },
    [ready],
  );

  /** While dragging the progress bar: move the picture without a request per step. */
  const scrub = useCallback(
    (seconds: number) => {
      scrubbingRef.current = true;
      setCurrent(seconds);
      ready()?.seekTo(seconds, false);
    },
    [ready],
  );

  const seekBy = useCallback(
    (delta: number) => {
      const p = ready();
      if (!p) return;
      seekTo(clampSeek(p.getCurrentTime(), delta, p.getDuration() || videoRef.current.durationSeconds));
      setFlash({ dir: delta < 0 ? "back" : "forward", key: Date.now() });
    },
    [ready, seekTo],
  );

  const changeVolume = useCallback(
    (v: number) => {
      setVolume(v);
      writePref("zt.volume", v);
      const mute = v === 0;
      setMuted(mute);
      writePref("zt.muted", mute ? 1 : 0);
      const p = ready();
      if (!p) return;
      p.setVolume(v);
      if (mute) p.mute();
      else p.unMute();
    },
    [ready],
  );

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    writePref("zt.muted", next ? 1 : 0);
    const p = ready();
    if (!p) return;
    if (next) p.mute();
    else {
      p.unMute();
      if (volume === 0) changeVolume(50);
    }
  }, [muted, volume, changeVolume, ready]);

  const changeRate = useCallback(
    (r: number) => {
      setRate(r);
      writePref("zt.rate", r);
      ready()?.setPlaybackRate(r);
    },
    [ready],
  );

  const toggleAutoplay = useCallback(() => {
    setAutoplay((a) => {
      writePref("zt.autoplay", a ? 0 : 1);
      return !a;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenEnabled) {
      setPageFullscreen((v) => !v);
      return;
    }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else containerRef.current?.requestFullscreen().catch(() => {});
  }, []);

  /** ⏮ / ⏭, only when there is somewhere to go. */
  const navigate = useCallback((dir: NavDirection) => {
    const v = videoRef.current;
    if (dir === "next" ? v.next : v.prev) onNavigateRef.current(dir);
  }, []);
  const goNext = useCallback(() => navigate("next"), [navigate]);

  useEffect(() => {
    const onChange = () => {
      const fs = document.fullscreenElement;
      setNativeFullscreen(!!fs && fs === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Page-level "fullscreen": Esc leaves it and the page underneath must not scroll.
  useEffect(() => {
    if (!pageFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pageFullscreen]);

  // ---- keyboard shortcuts --------------------------------------------------------------------
  useEffect(() => {
    // The mini player shares the page with other content: the keys belong to that page.
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (isTypingTarget(document.activeElement as HTMLElement | null)) return;
      if (target?.closest('[role="menu"], [role="dialog"], [role="alertdialog"]')) return;
      if (e.key === "Escape" && pageFullscreen) {
        setPageFullscreen(false);
        return;
      }
      const action = shortcutFor(e.key, e.shiftKey);
      if (!action) return;
      if (action.type === "next" || action.type === "prev") {
        e.preventDefault();
        navigate(action.type);
        return;
      }
      if (ended || failed) return;
      // Space/Enter on a focused button or link already activates it; don't toggle twice.
      if (e.key === " " && target?.closest("button, a")) return;
      // Arrow keys on the progress/volume sliders move the slider itself.
      if (action.type === "seek" && e.key.startsWith("Arrow") && target?.tagName === "INPUT") return;
      e.preventDefault();
      showControls();
      if (action.type === "toggle") toggle();
      else if (action.type === "seek") seekBy(action.delta);
      else if (action.type === "fullscreen") toggleFullscreen();
      else toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact, ended, failed, pageFullscreen, toggle, seekBy, toggleFullscreen, toggleMute, navigate, showControls]);

  // ---- YouTube player: created once --------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const first = videoRef.current;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        const mount = document.createElement("div");
        hostRef.current.replaceChildren(mount);
        loadedIdRef.current = first.id;
        playerRef.current = new YT.Player(mount, {
          videoId: first.id,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            cc_load_policy: 0,
            start: first.startAt,
          },
          events: {
            onReady: () => {
              const p = playerRef.current;
              if (!p || cancelled) return;
              readyRef.current = true;
              // Keep Tab out of YouTube's frame (its keyboard is off and our shortcuts would stop working).
              p.getIframe?.()?.setAttribute("tabindex", "-1");
              const v = readPref("zt.volume", 100);
              const m = readPref("zt.muted", 0) === 1;
              const r = readPref("zt.rate", 1);
              setVolume(v);
              setMuted(m);
              setRate(r);
              setAutoplay(readPref("zt.autoplay", 1) === 1);
              p.setVolume(v);
              if (m) p.mute();
              else p.unMute();
              p.setPlaybackRate(r);
              hideCaptions(p);
              // The page moved on to another video while YouTube was getting ready.
              const wanted = videoRef.current;
              if (wanted.id !== loadedIdRef.current) {
                loadedIdRef.current = wanted.id;
                p.loadVideoById({ videoId: wanted.id, startSeconds: wanted.startAt });
              }
              tick();
              setStatus((s) => (s === "loading" ? "unstarted" : s));
            },
            onStateChange: ({ data }) => {
              const p = playerRef.current;
              if (data === YT.PlayerState.PLAYING) {
                clearTimeout(playFallbackTimer.current);
                setTapThrough(false);
                setStatus("playing");
                syncUntil.current = Date.now() + YT_CHROME_MS;
                stopTimers();
                saveTimer.current = setInterval(save, PROGRESS_SAVE_INTERVAL_MS);
                uiTimer.current = setInterval(tick, UI_TICK_MS);
                showControls();
                // YouTube may bring its caption module back with each video.
                if (p) hideCaptions(p);
                const id = loadedIdRef.current;
                if (id && startedIdRef.current !== id) {
                  startedIdRef.current = id;
                  onStartedRef.current(id);
                }
              } else if (data === YT.PlayerState.BUFFERING) {
                setStatus("buffering");
              } else if (data === YT.PlayerState.PAUSED) {
                setRevealed(false);
                setStatus("paused");
                stopTimers();
                tick();
                save();
              } else if (data === YT.PlayerState.ENDED) {
                stopTimers();
                const id = loadedIdRef.current;
                const d = p?.getDuration() || videoRef.current.durationSeconds;
                endedRef.current = true;
                setEnded(true);
                setStatus("paused");
                if (id)
                  saveProgressAction(id, d, d)
                    .then(() => router.refresh())
                    .catch(() => {});
              } else if (data === YT.PlayerState.UNSTARTED || data === YT.PlayerState.CUED) {
                setRevealed(false);
                setStatus("unstarted");
              }
            },
            // 100: removed/private, 101/150: embedding disabled by the owner.
            // The failure screen covers the player inside it, so fullscreen stays on.
            onError: () => {
              stopTimers();
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
      stopTimers();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
      save();
      readyRef.current = false;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [router, save, showControls, stopTimers, tick]);

  // ---- a new video from the page: load it into the same player -------------------------------
  useEffect(() => {
    const p = ready();
    if (!p || loadedIdRef.current === video.id) return;
    save();
    stopTimers();
    loadedIdRef.current = video.id;
    endedRef.current = false;
    setEnded(false);
    setFailed(false);
    setTapThrough(false);
    setCurrent(video.startAt);
    setDuration(video.durationSeconds);
    setBuffered(0);
    setRevealed(false);
    setStatus("loading");
    p.loadVideoById({ videoId: video.id, startSeconds: video.startAt });
    // Only the id decides when to switch; startAt/duration are read for that id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  // ---- Media Session: keyboard media keys, headsets, lock screen --------------------------------
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title: video.title,
        artist: video.channelTitle,
        artwork: video.thumbnailUrl ? [{ src: video.thumbnailUrl }] : [],
      });
    } catch {
      /* MediaMetadata unsupported */
    }
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* action unsupported */
      }
    };
    set("play", () => ready()?.playVideo());
    set("pause", () => ready()?.pauseVideo());
    set("nexttrack", video.next ? () => navigate("next") : null);
    set("previoustrack", video.prev ? () => navigate("prev") : null);
    return () => {
      for (const a of ["play", "pause", "nexttrack", "previoustrack"] as MediaSessionAction[]) set(a, null);
    };
  }, [video.title, video.channelTitle, video.thumbnailUrl, video.next, video.prev, navigate, ready]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    }
  }, [playing]);

  // ---- pointer handling on the video surface -------------------------------------------------
  const onSurfacePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") {
      if (e.button === 0) toggle();
      return;
    }
    // Touch/pen: single tap shows/hides the controls; double tap on the sides seeks 10 s.
    const rect = e.currentTarget.getBoundingClientRect();
    const zone = tapZone(e.clientX - rect.left, rect.width);
    const now = Date.now();
    const prev = lastTap.current;
    if (prev && now - prev.time < DOUBLE_TAP_MS && prev.zone === zone) {
      clearTimeout(singleTapTimer.current);
      lastTap.current = null;
      if (zone === "back") seekBy(-10);
      else if (zone === "forward") seekBy(10);
      else toggle();
      return;
    }
    lastTap.current = { time: now, zone };
    clearTimeout(singleTapTimer.current);
    singleTapTimer.current = setTimeout(() => {
      const isPlaying = statusRef.current === "playing" || statusRef.current === "buffering";
      if (!isPlaying) toggle();
      else if (controlsVisibleRef.current) setControlsVisible(false);
      else showControls();
    }, DOUBLE_TAP_MS);
  };

  const replay = () => {
    const p = ready();
    endedRef.current = false;
    setEnded(false);
    if (!p) return;
    p.seekTo(0, true);
    p.playVideo();
  };

  const frameClass = `relative w-full overflow-hidden bg-black [container-type:size] ${
    pageFullscreen ? "!fixed inset-0 z-[100] h-[100dvh]" : `aspect-video ${nativeFullscreen || compact ? "" : "rounded-[14px]"}`
  }`;

  const showPoster =
    !tapThrough && (status === "loading" || status === "unstarted" || status === "paused" || !revealed);
  const busy = status === "loading" || status === "buffering";
  const nextLabel = video.source === "playlist" ? "Próximo da playlist" : "Próximo da fila";

  return (
    <div
      ref={setContainer}
      className={`group/player ${frameClass} ${showChrome || ended || failed ? "" : "cursor-none"}`}
      onPointerMove={(e) => e.pointerType === "mouse" && showControls()}
    >
      {/* YouTube draws the video here; it only receives taps in the iPhone play fallback. */}
      <div
        ref={hostRef}
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${tapThrough ? "" : "pointer-events-none"}`}
        style={{
          // The 16:9 box that fits the player (any shape: inline, fullscreen, ultrawide, phone landscape),
          // plus the crop strips above and below it, centred. cq units come from the player's container-type.
          width: "min(100cqw, calc(100cqh * 16 / 9))",
          height: `calc(min(calc(100cqw * 9 / 16), 100cqh) + ${2 * FRAME_CROP_PX}px)`,
        }}
        aria-hidden={!tapThrough}
      />

      {/* Poster: before start and while paused, so YouTube's own pause screen never shows. */}
      {/* Shows at once, fades out once playback has really started. */}
      {!tapThrough && (
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity ${
            showPoster ? "opacity-100 duration-0" : "opacity-0 duration-300"
          }`}
        >
          {video.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- full-bleed poster over the iframe
            <img src={video.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/35" />
        </div>
      )}

      {tapThrough ? (
        <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-black/70 px-3 py-1.5 text-sm text-white">
          Toque no vídeo para começar
        </p>
      ) : (
        /* Our surface: catches every click/tap over the video. */
        <div
          className="absolute inset-0 touch-manipulation"
          onPointerDown={(e) => {
            pointerTypeRef.current = e.pointerType;
          }}
          onPointerUp={onSurfacePointerUp}
          onDoubleClick={() => pointerTypeRef.current === "mouse" && (compact ? onExpand?.() : toggleFullscreen())}
        />
      )}

      {/* ⏮ ▶/⏸ ⏭ in the middle, whenever the controls show. */}
      {!tapThrough && !(compact && (ended || failed)) && (
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 [&_button]:pointer-events-auto ${
            showChrome || showPoster ? "opacity-100" : "opacity-0 [&_button]:!pointer-events-none"
          }`}
        >
          <NavButtons prev={video.prev} next={video.next} onNavigate={navigate} small={compact}>
            {/* Light blue outline icon on a faint disc, so the picture stays visible. */}
            <button
              type="button"
              onClick={toggle}
              disabled={status === "loading"}
              aria-label={playing ? "Pausar" : "Reproduzir"}
              className={`flex items-center justify-center rounded-full bg-accent/10 text-accent/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)] transition-[background-color,color,transform] hover:scale-105 hover:bg-accent/25 hover:text-accent ${
                compact ? "h-11 w-11" : "h-16 w-16"
              }`}
            >
              {busy ? (
                <Loader2 className={`${compact ? "h-5 w-5" : "h-7 w-7"} animate-spin`} strokeWidth={1.5} />
              ) : playing ? (
                <Pause className={compact ? "h-5 w-5" : "h-7 w-7"} strokeWidth={1.5} />
              ) : (
                <Play className={compact ? "ml-0.5 h-5 w-5" : "ml-1 h-7 w-7"} strokeWidth={1.5} />
              )}
            </button>
          </NavButtons>
        </div>
      )}
      {status === "buffering" && !showChrome && (
        <Loader2 className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/90" />
      )}

      {flash && (
        <span
          key={flash.key}
          className={`pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-black/60 px-3 py-2 text-sm font-medium text-white animate-[fade-in_150ms_ease-out] ${
            flash.dir === "back" ? "left-[12%]" : "right-[12%]"
          }`}
          onAnimationEnd={() => setTimeout(() => setFlash((f) => (f?.key === flash.key ? null : f)), 450)}
        >
          {flash.dir === "back" ? <RotateCcw className="h-4 w-4" /> : <RotateCw className="h-4 w-4" />} 10 s
        </span>
      )}

      {!compact && status !== "loading" && !tapThrough && !ended && !failed && (
        <div
          // Stays visible while a control has keyboard focus, so Tab never lands on something invisible.
          className={`absolute inset-x-0 bottom-0 transition-opacity duration-200 ${
            showChrome
              ? "opacity-100"
              : "pointer-events-none opacity-0 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:opacity-100"
          }`}
          onPointerMove={showControls}
        >
          <PlayerControls
            playing={playing}
            current={current}
            duration={duration}
            buffered={buffered}
            volume={volume}
            muted={muted}
            rate={rate}
            fullscreen={fullscreen}
            canFullscreen
            portalContainer={containerEl}
            onToggle={toggle}
            onScrub={scrub}
            onSeekTo={seekTo}
            onVolume={changeVolume}
            onToggleMute={toggleMute}
            onRate={changeRate}
            onFullscreen={toggleFullscreen}
            onMenuOpenChange={(open) => {
              setMenuOpen(open);
              if (!open) showControls();
            }}
            showAutoplay={!!video.next}
            autoplay={autoplay}
            onAutoplay={toggleAutoplay}
          />
        </div>
      )}

      {/* End and failure screens cover the player inside it, so fullscreen stays on for the next video. */}
      {ended && (
        <EndScreen
          key={video.id}
          next={video.next}
          nextLabel={nextLabel}
          autoplay={autoplay}
          compact={compact}
          onNext={goNext}
          onReplay={replay}
        />
      )}
      {failed && <FailedScreen key={video.id} video={video} autoplay={autoplay} compact={compact} onNavigate={navigate} />}

      {compact && (
        <>
          {/* Thin progress line; the full controls live on the watch page. */}
          {!ended && !failed && duration > 0 && (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
              <span className="block h-full bg-accent" style={{ width: `${Math.min(100, (current / duration) * 100)}%` }} />
            </span>
          )}
          <div
            className={`absolute right-1.5 top-1.5 flex gap-1 transition-opacity duration-200 ${
              showChrome || showPoster || ended || failed ? "opacity-100" : "opacity-0 focus-within:opacity-100"
            }`}
          >
            <button type="button" onClick={onExpand} aria-label="Abrir o vídeo" title="Abrir o vídeo" className={miniButton}>
              <Maximize2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} aria-label="Fechar o miniplayer" title="Fechar" className={miniButton}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const miniButton =
  "flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75";

/** The video cannot play here (removed, private, embedding off): open it on YouTube or move on. */
function FailedScreen({
  video,
  autoplay,
  compact,
  onNavigate,
}: {
  video: CurrentVideo;
  autoplay: boolean;
  compact: boolean;
  onNavigate: (dir: NavDirection) => void;
}) {
  const [left, setLeft] = useState(AUTOPLAY_COUNTDOWN_S);
  const skipping = autoplay && !!video.next;
  useEffect(() => {
    if (!skipping) return;
    if (left <= 0) {
      onNavigate("next");
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [skipping, left, onNavigate]);

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center bg-surface text-center ${
        compact ? "gap-2 px-3 text-sm" : "gap-4 px-6"
      }`}
    >
      <p className="max-w-md text-pretty">Não foi possível tocar este vídeo aqui.</p>
      <a
        href={`https://www.youtube.com/watch?v=${video.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
      >
        <ExternalLink className="h-4 w-4" /> Abrir no YouTube
      </a>
      {skipping && <p className="text-sm text-muted">Pulando para o próximo em {left} s</p>}
      {!compact && <NavButtons prev={video.prev} next={video.next} onNavigate={onNavigate} />}
    </div>
  );
}
