import { currentUserId } from "@/lib/auth/require";
import { getDb } from "@/lib/db/client";
import { getUserImage } from "@/lib/queries/users";

/** The signed-in user's profile photo. URLs carry ?v=<update time>, so the response can be cached for long. */
export async function GET(): Promise<Response> {
  const userId = await currentUserId();
  const img = userId === null ? null : await getUserImage(getDb(), userId);
  if (!img) return new Response(null, { status: 404 });
  return new Response(Buffer.from(img.data, "base64"), {
    headers: {
      "content-type": img.contentType,
      "cache-control": "private, max-age=2592000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
