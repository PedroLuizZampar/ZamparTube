-- Rename existing duplicates (ignoring case) before the unique index; "Assistir depois" keeps its name.
-- The suffix uses the row id ("Nome (#12)"), so a renamed playlist cannot clash with another existing name.
UPDATE "playlists" AS p SET "name" = p."name" || ' (#' || p."id" || ')'
FROM (
  SELECT "id", row_number() OVER (PARTITION BY lower("name") ORDER BY "is_watch_later" DESC, "id") AS rn
  FROM "playlists"
) AS d
WHERE p."id" = d."id" AND d.rn > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "playlists_name_lower_unique" ON "playlists" USING btree (lower("name"));
