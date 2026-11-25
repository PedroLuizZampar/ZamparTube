import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "zt_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

const key = (secret: string) => new TextEncoder().encode(secret);

/** A session belongs to one account: the token's subject is the user id. */
export async function createSessionToken(userId: number, secret: string): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key(secret));
}

/** The user id of a valid token, or null (also for tokens from before accounts existed, whose subject was "owner"). */
export async function verifySessionToken(token: string | undefined, secret: string): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    const id = Number(payload.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** Constant-time string comparison (used for the invite code) (runs in any runtime, no node:crypto needed). */
export function checkPassword(input: string, expected: string): boolean {
  const a = new TextEncoder().encode(input);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0 && expected.length > 0;
}

const PUBLIC_EXACT = new Set(["/login", "/signup", "/api/cron/sync", "/manifest.webmanifest", "/favicon.ico"]);

/** Paths reachable without a session. */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  return /^\/(apple-)?icon[\w-]*\.(png|svg|ico)$/.test(pathname);
}
