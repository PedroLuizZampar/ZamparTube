CREATE TABLE "channel_categories" (
	"channel_id" text NOT NULL,
	"category_id" integer NOT NULL,
	CONSTRAINT "channel_categories_channel_id_category_id_pk" PRIMARY KEY("channel_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "channels" DROP CONSTRAINT "channels_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "channel_categories" ADD CONSTRAINT "channel_categories_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_categories" ADD CONSTRAINT "channel_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_categories_category_idx" ON "channel_categories" USING btree ("category_id");--> statement-breakpoint
-- Keep every existing assignment before the single-category column goes away.
INSERT INTO "channel_categories" ("channel_id", "category_id")
SELECT "id", "category_id" FROM "channels" WHERE "category_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" DROP COLUMN "category_id";