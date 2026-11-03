import "server-only";

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8000;

export interface StoredImage {
  base64: string;
  contentType: string;
}

/** Downloads a channel avatar once on the server. Any failure (429, non-image, too big) returns null. */
export async function fetchAvatarImage(url: string, fetchFn: typeof fetch = fetch): Promise<StoredImage | null> {
  if (!url) return null;
  try {
    const res = await fetchFn(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const contentType = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!res.ok || !contentType.startsWith("image/")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;
    return { base64: Buffer.from(bytes).toString("base64"), contentType };
  } catch {
    return null;
  }
}
