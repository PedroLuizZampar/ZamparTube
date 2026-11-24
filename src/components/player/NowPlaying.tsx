"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { loadNowPlayingAction, markPlayingAction } from "@/app/(app)/queue/actions";
import type { CurrentVideo } from "@/lib/queries/now-playing";
import { Player } from "../Player";
import { NavButtons } from "./NavButtons";
import { useMiniPlacement } from "./useMiniPlacement";

export type { CurrentVideo };
export type NavDirection = "prev" | "next";

interface HostApi {
  publish: (video: CurrentVideo) => void;
  /** The watch page's placeholder: the big player is drawn over it. */
  setSlot: (el: HTMLElement | null) => void;
}

const HostContext = createContext<HostApi | null>(null);

type Box = { top: number; left: number; width: number; height: number };

/**
 * Lives in the app layout, so the player outlives every page: on a watch page it sits over the page's
 * placeholder; anywhere else it keeps playing in a mini player in the corner. The YouTube frame is never moved
 * in the DOM (that would reload it): only this wrapper's position changes.
 */
export function PlayerHost({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const onWatch = pathname.startsWith("/watch/");
  const [video, setVideo] = useState<CurrentVideo | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const videoRef = useRef(video);
  useEffect(() => {
    videoRef.current = video;
  }, [video]);

  // Follow the placeholder (document coordinates, so page scrolling needs no work).
  useLayoutEffect(() => {
    if (!slot) return;
    const measure = () => {
      const r = slot.getBoundingClientRect();
      setBox({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [slot]);

  const navigate = useCallback(
    async (dir: NavDirection) => {
      const v = videoRef.current;
      const target = v && (dir === "next" ? v.next : v.prev);
      if (!v || !target) return;
      if (onWatch) {
        router.push(target.href, { scroll: false });
        return;
      }
      // Mini player: move on without leaving the page.
      const nextVideo = await loadNowPlayingAction(target.id, v.listId).catch(() => null);
      if (nextVideo) setVideo(nextVideo);
    },
    [onWatch, router],
  );

  const onStarted = useCallback((id: string) => {
    const v = videoRef.current;
    if (v?.id === id && v.source === "queue") markPlayingAction(id).catch(() => {});
  }, []);

  const close = useCallback(() => setVideo(null), []);
  const expand = useCallback(() => {
    const v = videoRef.current;
    if (v) router.push(v.href);
  }, [router]);

  const [api] = useState<HostApi>(() => ({ publish: setVideo, setSlot }));

  // Outside the watch page only a playable video is worth keeping on screen.
  const mini = !onWatch;
  const show = video && (onWatch ? !!box : video.embeddable);
  const miniPlacement = useMiniPlacement();

  return (
    <HostContext.Provider value={api}>
      {children}
      {show && (
        // One wrapper for both sizes: swapping elements would remount the player and reload YouTube's frame.
        <div
          className={
            mini
              ? `group/mini fixed z-40 touch-none animate-[mini-in_220ms_ease-out] overflow-hidden rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.55)] ${
                  miniPlacement.dragging ? "cursor-grabbing select-none" : ""
                }`
              : "absolute z-20"
          }
          style={mini ? miniPlacement.style : (box ?? undefined)}
          data-no-ptr={mini || undefined}
          {...(mini ? miniPlacement.frameProps : {})}
        >
          {video.embeddable ? (
            <Player
              video={video}
              compact={mini}
              onNavigate={navigate}
              onStarted={onStarted}
              onExpand={expand}
              onClose={close}
            />
          ) : (
            <NotEmbeddable video={video} onNavigate={navigate} />
          )}
          {mini && (
            // Top-left corner: drag to resize (the bottom-right corner stays put).
            <span
              {...miniPlacement.resizeHandleProps}
              aria-hidden
              title="Arraste para redimensionar"
              className="absolute left-0 top-0 z-10 h-6 w-6 cursor-nwse-resize opacity-60 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/mini:opacity-100"
            >
              <span className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-tl-[3px] border-l-2 border-t-2 border-white/80" />
            </span>
          )}
        </div>
      )}
    </HostContext.Provider>
  );
}

function NotEmbeddable({ video, onNavigate }: { video: CurrentVideo; onNavigate: (dir: NavDirection) => void }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[14px] bg-black">
      {video.thumbnailUrl && <Image src={video.thumbnailUrl} alt="" fill unoptimized className="object-cover opacity-40" />}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-md text-pretty">O canal não permite assistir este vídeo fora do YouTube.</p>
        <a
          href={`https://www.youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
        >
          <ExternalLink className="h-4 w-4" /> Abrir no YouTube
        </a>
        <NavButtons prev={video.prev} next={video.next} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

/**
 * Rendered by the watch page where the player goes: hands it the video on screen and leaves a placeholder of the
 * player's size for it to cover.
 */
export function NowPlaying({ video }: { video: CurrentVideo }) {
  const host = useContext(HostContext);
  // Re-publish when anything the player shows changes (a refresh may update prev/next for the same video).
  const key = JSON.stringify(video);
  useEffect(() => {
    host?.publish(JSON.parse(key) as CurrentVideo);
  }, [host, key]);
  const slotRef = useCallback((el: HTMLDivElement | null) => host?.setSlot(el), [host]);
  return <div ref={slotRef} className="aspect-video w-full rounded-[14px] bg-black" />;
}
