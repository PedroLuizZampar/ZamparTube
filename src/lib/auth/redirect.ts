const PROBE_ORIGIN = "http://zampartube.invalid";

/**
 * Where to go after login. Only same-site paths survive; anything that the URL parser
 * would resolve to another origin (//host, /\host, control characters, schemes) becomes "/".
 */
export function safeNextPath(value: string): string {
  if (!value.startsWith("/") || /[\u0000-\u001f\\]/.test(value)) return "/";
  try {
    const url = new URL(value, PROBE_ORIGIN);
    return url.origin === PROBE_ORIGIN ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
