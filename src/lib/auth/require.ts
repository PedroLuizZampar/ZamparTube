import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/** Defence in depth for Server Actions: the proxy already guards pages, but actions check too. */
export async function requireSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token, process.env.SESSION_SECRET ?? ""))) {
    throw new Error("Sessão expirada. Entre de novo.");
  }
}
