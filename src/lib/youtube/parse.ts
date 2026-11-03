export type ChannelRef = { kind: "id"; id: string } | { kind: "handle"; handle: string };

export type ParseChannelResult = { ok: true; ref: ChannelRef } | { ok: false; error: string };

const CHANNEL_ID = /^UC[\w-]{22}$/;
const HANDLE = /^[\w.-]{3,30}$/;
const YT_HOST = /^(?:www\.|m\.)?youtube\.com$/i;

const ERR_EMPTY = "Cole o link do canal, o @ do canal ou o ID (UC…).";
const ERR_LEGACY =
  "Esse formato de link antigo não é suportado. Abra o canal no YouTube e copie o link com @ (ex.: youtube.com/@canal).";
const ERR_INVALID = "Não reconheci esse canal. Use o link do canal, o @ do canal ou o ID (UC…).";

export function parseChannelInput(input: string): ParseChannelResult {
  const value = input.trim();
  if (!value) return { ok: false, error: ERR_EMPTY };

  if (value.startsWith("@")) return handleRef(value.slice(1));
  if (CHANNEL_ID.test(value)) return { ok: true, ref: { kind: "id", id: value } };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return { ok: false, error: ERR_INVALID };
  }
  if (!YT_HOST.test(url.hostname)) return { ok: false, error: ERR_INVALID };

  const [first, second] = url.pathname.split("/").filter(Boolean);
  if (!first) return { ok: false, error: ERR_INVALID };
  if (first.startsWith("@")) return handleRef(decodeURIComponent(first.slice(1)));
  if (first === "channel" && second && CHANNEL_ID.test(second)) return { ok: true, ref: { kind: "id", id: second } };
  if (first === "c" || first === "user") return { ok: false, error: ERR_LEGACY };
  return { ok: false, error: ERR_INVALID };
}

function handleRef(handle: string): ParseChannelResult {
  return HANDLE.test(handle) ? { ok: true, ref: { kind: "handle", handle } } : { ok: false, error: ERR_INVALID };
}

/** ISO 8601 duration (as returned by videos.list contentDetails.duration) to seconds. */
export function parseIsoDuration(iso: string): number {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso);
  if (!m) return 0;
  const [, w, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return Math.floor(w * 604800 + d * 86400 + h * 3600 + min * 60 + s);
}

const withPrefix = (prefix: string) => (channelId: string) => prefix + channelId.replace(/^UC/, "");

/** Long-form uploads only (no Shorts, no lives). Undocumented but long-standing. */
export const longVideosPlaylistId = withPrefix("UULF");
/** Live streams (past, current, upcoming). Undocumented but long-standing. */
export const livesPlaylistId = withPrefix("UULV");
/** All uploads (documented). Fallback when UULF is missing. */
export const uploadsPlaylistId = withPrefix("UU");
