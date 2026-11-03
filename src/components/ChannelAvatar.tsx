"use client";

import { useState } from "react";

/** Channel photo served by the app itself; falls back to the channel's initial. */
export function ChannelAvatar({ src, name, size }: { src: string; name: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (!src || failed) {
    return (
      <span
        aria-hidden
        style={{ ...style, fontSize: Math.round(size * 0.42) }}
        className="flex shrink-0 select-none items-center justify-center rounded-full bg-surface-2 font-semibold uppercase text-muted"
      >
        {name.trim().charAt(0) || "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small same-origin image; next/image adds nothing here
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={style}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-surface-2 object-cover"
    />
  );
}
