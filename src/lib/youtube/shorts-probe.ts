import "server-only";

export type ProbeResult = "short" | "not_short" | "unknown";

const TIMEOUT_MS = 5000;

/**
 * Asks youtube.com whether a video is a Short: /shorts/{id} answers 200 for Shorts and
 * redirects to /watch for regular videos. Anything else (consent page, 429, errors) is "unknown".
 */
export async function probeShort(videoId: string, fetchFn: typeof fetch = fetch): Promise<ProbeResult> {
  try {
    const res = await fetchFn(`https://www.youtube.com/shorts/${encodeURIComponent(videoId)}`, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "accept-language": "en-US,en;q=0.8" },
    });
    if (res.status === 200) return "short";
    if (res.status >= 300 && res.status < 400) {
      const target = new URL(res.headers.get("location") ?? "", "https://www.youtube.com");
      return /(^|\.)youtube\.com$/.test(target.hostname) && target.pathname === "/watch" ? "not_short" : "unknown";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}
