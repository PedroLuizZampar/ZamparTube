CREATE TABLE "queue_items" (
	"video_id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"played_at" timestamp with time zone,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "queue_items_played_idx" ON "queue_items" USING btree ("played_at");