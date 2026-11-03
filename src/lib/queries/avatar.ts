import { sql } from "drizzle-orm";
import { channels } from "@/lib/db/schema";

/** "/avatar/<id>?v=<fetch epoch>" once the image is stored, "" otherwise (the UI shows the initial). */
export const avatarSrcSql = sql<string>`case when ${channels.avatarData} is not null
  then '/avatar/' || ${channels.id} || '?v=' || floor(extract(epoch from ${channels.avatarFetchedAt}))::bigint::text
  else '' end`;
