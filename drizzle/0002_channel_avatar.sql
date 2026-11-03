ALTER TABLE "channels" ADD COLUMN "avatar_data" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "avatar_content_type" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "avatar_fetched_at" timestamp with time zone;