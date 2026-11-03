import Image from "next/image";
import Link from "next/link";
import { Check, EyeOff, Radio } from "lucide-react";
import { dismissAction } from "@/app/(app)/actions";
import { formatDuration, formatRelative } from "@/lib/format";
import { ChannelAvatar } from "./ChannelAvatar";
import type { VideoCardData } from "@/lib/queries/videos";

interface Props {
  video: VideoCardData;
  /** Shows the "Dispensar" control (feed only). */
  onFeed?: boolean;
  /** Extra query string for the watch link, e.g. "?list=3". */
  watchQuery?: string;
  /** Hide the channel line (on a channel page). */
  hideChannel?: boolean;
}

export function VideoCard({ video, onFeed = false, watchQuery = "", hideChannel = false }: Props) {
  const href = `/watch/${video.id}${watchQuery}`;
  const progress =
    video.durationSeconds > 0 && video.positionSeconds > 0
      ? Math.min(100, (video.positionSeconds / video.durationSeconds) * 100)
      : 0;

  return (
    <article className="group flex flex-col gap-3">
      <Link
        href={href}
        className="relative block aspect-video overflow-hidden rounded-[14px] bg-surface-2 outline-offset-4"
        aria-label={video.title}
      >
        {video.thumbnailUrl && (
          <Image
            src={video.thumbnailUrl}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className={`object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] ${
              video.watched ? "opacity-50" : ""
            }`}
          />
        )}
        {(video.isLiveRecording || video.watched) && (
          <span className="absolute left-2 top-2 flex flex-wrap gap-1">
            {video.watched && (
              <span className="flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-text">
                <Check className="h-3 w-3 text-accent" /> Assistido
              </span>
            )}
            {video.isLiveRecording && (
              <span className="flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-text">
                <Radio className="h-3 w-3 text-accent" /> Gravação de live
              </span>
            )}
          </span>
        )}
        <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 text-xs font-medium tabular-nums text-text">
          {formatDuration(video.durationSeconds)}
        </span>
        {progress > 0 && !video.watched && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <span className="block h-full bg-accent" style={{ width: `${progress}%` }} />
          </span>
        )}
      </Link>

      <div className="flex gap-3">
        {!hideChannel && (
          <Link href={`/channel/${video.channelId}`} className="shrink-0" aria-label={video.channelTitle}>
            <ChannelAvatar src={video.channelAvatarSrc} name={video.channelTitle} size={36} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <Link href={href} className="line-clamp-2 font-medium leading-snug text-text hover:text-accent">
            {video.title}
          </Link>
          <p className="mt-1 truncate text-sm text-muted">
            {!hideChannel && (
              <>
                <Link href={`/channel/${video.channelId}`} className="hover:text-text">
                  {video.channelTitle}
                </Link>
                <span aria-hidden> · </span>
              </>
            )}
            <time dateTime={video.publishedAt.toISOString()}>{formatRelative(video.publishedAt)}</time>
          </p>
        </div>
        {onFeed && (
          <form action={dismissAction.bind(null, video.id)} className="shrink-0">
            <button
              type="submit"
              title="Dispensar do feed"
              aria-label={`Dispensar "${video.title}" do feed`}
              className="rounded-lg p-1.5 text-muted transition-opacity hover:bg-surface hover:text-text [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
            >
              <EyeOff className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </form>
        )}
      </div>
    </article>
  );
}

export function VideoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>
  );
}
