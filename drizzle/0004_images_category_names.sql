ALTER TABLE "categories" DROP CONSTRAINT "categories_name_unique";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_data" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_content_type" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "image_data" text;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "image_content_type" text;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "image_updated_at" timestamp with time zone;--> statement-breakpoint
-- Rename category names that differ only by case to "Nome (#id)" before the case-insensitive unique index.
UPDATE "categories" AS c SET "name" = c."name" || ' (#' || c."id" || ')'
FROM (SELECT "id", row_number() OVER (PARTITION BY lower("name") ORDER BY "id") AS rn FROM "categories") AS d
WHERE c."id" = d."id" AND d.rn > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_lower_unique" ON "categories" USING btree (lower("name"));