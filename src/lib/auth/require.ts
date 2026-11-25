import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getUsername } from "@/lib/queries/users";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/**
 * The signed-in user's id, or null. The token alone is not enough: the account must still exist in this database
 * (a token signed for another database, or for a deleted account, does not count). Memoised per request.
 */
export const currentUserId = cache(async (): Promise<number | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const id = await verifySessionToken(token, process.env.SESSION_SECRET ?? "");
  if (id === null) return null;
  return (await getUsername(getDb(), id)) === null ? null : id;
});

/**
 * The signed-in user's id; without a session, goes to the login page. The proxy already guards pages, but every page
 * and Server Action asks again (defence in depth, and they need the id to scope their data).
 */
export async function requireUserId(): Promise<number> {
  const id = await currentUserId();
  if (id === null) redirect("/login");
  return id;
}
