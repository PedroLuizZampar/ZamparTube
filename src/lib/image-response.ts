import { getDb } from "@/lib/db/client";
import { getImage, type ImageKind } from "@/lib/queries/images";

/** Serves an uploaded picture. URLs carry ?v=<update time>, so the response can be cached for long. */
export async function imageResponse(kind: ImageKind, rawId: string): Promise<Response> {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return new Response(null, { status: 404 });
  const img = await getImage(getDb(), kind, id);
  if (!img) return new Response(null, { status: 404 });
  return new Response(Buffer.from(img.data, "base64"), {
    headers: {
      "content-type": img.contentType,
      "cache-control": "private, max-age=2592000, immutable",
      // The stored type is what the browser declared on upload; never let it be sniffed into something else.
      "x-content-type-options": "nosniff",
    },
  });
}
