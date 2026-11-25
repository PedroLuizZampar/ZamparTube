import { and, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { categories, playlists } from "@/lib/db/schema";

export type ImageKind = "category" | "playlist";
export interface StoredImage {
  data: string;
  contentType: string;
}

const tables = { category: categories, playlist: playlists } as const;

/** Local URL of the stored image, versioned by update time so browsers can cache it for long; "" when none. */
export function imageSrcSql(kind: ImageKind): SQL<string> {
  const t = tables[kind];
  const prefix = `/${kind}-image/`;
  return sql<string>`case when ${t.imageData} is null then ''
    else ${prefix}::text || ${t.id}::text || '?v=' || ((extract(epoch from ${t.imageUpdatedAt}) * 1000)::bigint)::text end`;
}

/** Stores (or with null, removes) the picture of one of the user's categories or playlists. */
export async function setImage(
  db: Db,
  userId: number,
  kind: ImageKind,
  id: number,
  img: StoredImage | null,
): Promise<void> {
  const t = tables[kind];
  await db
    .update(t)
    .set(
      img
        ? { imageData: img.data, imageContentType: img.contentType, imageUpdatedAt: new Date() }
        : { imageData: null, imageContentType: null, imageUpdatedAt: null },
    )
    .where(and(eq(t.id, id), eq(t.userId, userId)));
}

/** The picture of one of the user's categories or playlists. */
export async function getImage(db: Db, userId: number, kind: ImageKind, id: number): Promise<StoredImage | null> {
  const t = tables[kind];
  const [row] = await db
    .select({ data: t.imageData, contentType: t.imageContentType })
    .from(t)
    .where(and(eq(t.id, id), eq(t.userId, userId)));
  return row?.data && row.contentType ? { data: row.data, contentType: row.contentType } : null;
}
