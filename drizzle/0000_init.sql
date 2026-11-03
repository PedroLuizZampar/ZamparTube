CREATE TYPE "public"."live_state" AS ENUM('none', 'pending', 'ended');--> statement-breakpoint
CREATE TYPE "public"."shorts_check" AS ENUM('not_needed', 'pending', 'ok', 'short');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"handle" text,
	"avatar_url" text NOT NULL,
	"uploads_playlist_id" text NOT NULL,
	"category_id" integer,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"backfill_page_token" text,
	"long_playlist_missing" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_items" (
	"playlist_id" integer NOT NULL,
	"video_id" text NOT NULL,
	"position" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_items_playlist_id_video_id_pk" PRIMARY KEY("playlist_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_watch_later" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"duration_seconds" integer NOT NULL,
	"thumbnail_url" text NOT NULL,
	"embeddable" boolean DEFAULT true NOT NULL,
	"is_short" boolean DEFAULT false NOT NULL,
	"shorts_check" "shorts_check" NOT NULL,
	"shorts_check_failures" integer DEFAULT 0 NOT NULL,
	"is_live_recording" boolean DEFAULT false NOT NULL,
	"live_state" "live_state" NOT NULL,
	"in_feed" boolean NOT NULL,
	"dismissed_at" timestamp with time zone,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce("videos"."title", '') || ' ' || coalesce("videos"."description", ''))) STORED
);
--> statement-breakpoint
CREATE TABLE "watch_state" (
	"video_id" text PRIMARY KEY NOT NULL,
	"position_seconds" integer DEFAULT 0 NOT NULL,
	"watched" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_state" ADD CONSTRAINT "watch_state_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "playlists_single_watch_later" ON "playlists" USING btree ("is_watch_later") WHERE "playlists"."is_watch_later" = true;--> statement-breakpoint
CREATE INDEX "videos_channel_published_idx" ON "videos" USING btree ("channel_id","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "videos_published_idx" ON "videos" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "videos_search_idx" ON "videos" USING gin ("search_vector");