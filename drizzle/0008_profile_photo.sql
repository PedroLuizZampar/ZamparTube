ALTER TABLE "users" ADD COLUMN "image_data" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image_content_type" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image_updated_at" timestamp with time zone;