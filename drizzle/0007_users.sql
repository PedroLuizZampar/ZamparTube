-- Accounts. Everything that existed before goes to a placeholder owner (no password); the first account created
-- takes that row over, and with it every channel, category, playlist, history entry and queue item below.
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_unique" ON "users" USING btree (lower("username"));--> statement-breakpoint
INSERT INTO "users" ("username") VALUES ('dono');--> statement-breakpoint

-- Followed channels (channels and videos stay shared and are synced once).
CREATE TABLE "user_channels" (
	"user_id" integer NOT NULL,
	"channel_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_channels_user_id_channel_id_pk" PRIMARY KEY("user_id","channel_id")
);
--> statement-breakpoint
ALTER TABLE "user_channels" ADD CONSTRAINT "user_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_channels" ADD CONSTRAINT "user_channels_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_channels_channel_idx" ON "user_channels" USING btree ("channel_id");--> statement-breakpoint
INSERT INTO "user_channels" ("user_id", "channel_id", "added_at")
	SELECT (SELECT min("id") FROM "users"), "id", "added_at" FROM "channels" WHERE "removed_at" IS NULL;--> statement-breakpoint

-- Feed dismissals become per user.
CREATE TABLE "feed_dismissals" (
	"user_id" integer NOT NULL,
	"video_id" text NOT NULL,
	"dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feed_dismissals_user_id_video_id_pk" PRIMARY KEY("user_id","video_id")
);
--> statement-breakpoint
ALTER TABLE "feed_dismissals" ADD CONSTRAINT "feed_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_dismissals" ADD CONSTRAINT "feed_dismissals_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "feed_dismissals" ("user_id", "video_id", "dismissed_at")
	SELECT (SELECT min("id") FROM "users"), "id", "dismissed_at" FROM "videos" WHERE "dismissed_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" DROP COLUMN "dismissed_at";--> statement-breakpoint

-- Categories: owner + "hide from home".
DROP INDEX "categories_name_lower_unique";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "user_id" integer;--> statement-breakpoint
UPDATE "categories" SET "user_id" = (SELECT min("id") FROM "users");--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "hidden_from_home" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_name_lower_unique" ON "categories" USING btree ("user_id",lower("name"));--> statement-breakpoint

-- Playlists: owner; one "Assistir depois" and unique names per user.
DROP INDEX "playlists_name_lower_unique";--> statement-breakpoint
DROP INDEX "playlists_single_watch_later";--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "user_id" integer;--> statement-breakpoint
UPDATE "playlists" SET "user_id" = (SELECT min("id") FROM "users");--> statement-breakpoint
ALTER TABLE "playlists" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "playlists_user_name_lower_unique" ON "playlists" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "playlists_single_watch_later" ON "playlists" USING btree ("user_id") WHERE "playlists"."is_watch_later" = true;--> statement-breakpoint

-- Watch state: per user.
ALTER TABLE "watch_state" DROP CONSTRAINT "watch_state_pkey";--> statement-breakpoint
ALTER TABLE "watch_state" ADD COLUMN "user_id" integer;--> statement-breakpoint
UPDATE "watch_state" SET "user_id" = (SELECT min("id") FROM "users");--> statement-breakpoint
ALTER TABLE "watch_state" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "watch_state" ADD CONSTRAINT "watch_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_state" ADD CONSTRAINT "watch_state_user_id_video_id_pk" PRIMARY KEY("user_id","video_id");--> statement-breakpoint

-- Queue: per user.
ALTER TABLE "queue_items" DROP CONSTRAINT "queue_items_pkey";--> statement-breakpoint
DROP INDEX "queue_items_played_idx";--> statement-breakpoint
ALTER TABLE "queue_items" ADD COLUMN "user_id" integer;--> statement-breakpoint
UPDATE "queue_items" SET "user_id" = (SELECT min("id") FROM "users");--> statement-breakpoint
ALTER TABLE "queue_items" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_user_id_video_id_pk" PRIMARY KEY("user_id","video_id");--> statement-breakpoint
CREATE INDEX "queue_items_user_played_idx" ON "queue_items" USING btree ("user_id","played_at");
