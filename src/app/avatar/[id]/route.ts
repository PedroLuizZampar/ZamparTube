import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { channels } from "@/lib/db/schema";

/** Serves a channel avatar stored during sync. The URL carries ?v=<fetch time>, so it can be cached for long. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const [row] = await getDb()
    .select({ data: channels.avatarData, contentType: channels.avatarContentType })
    .from(channels)
    .where(eq(channels.id, id));
  if (!row?.data || !row.contentType) return new Response(null, { status: 404 });
  return new Response(Buffer.from(row.data, "base64"), {
    headers: {
      "content-type": row.contentType,
      "cache-control": "private, max-age=2592000, immutable",
    },
  });
}
