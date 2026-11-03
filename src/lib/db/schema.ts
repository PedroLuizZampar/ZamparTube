import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const shortsCheckEnum = pgEnum("shorts_check", ["not_needed", "pending", "ok", "short"]);
export const liveStateEnum = pgEnum("live_state", ["none", "pending", "ended"]);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  position: integer("position").notNull().default(0),
});

export const channels = pgTable("channels", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  handle: text("handle"),
  avatarUrl: text("avatar_url").notNull(),
  uploadsPlaylistId: text("uploads_playlist_id").notNull(),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  backfillPageToken: text("backfill_page_token"),
  longPlaylistMissing: boolean("long_playlist_missing").notNull().default(false),
  /** Avatar image stored as base64 and served by /avatar/[id], so browsers never hit Google (which rate-limits). */
  avatarData: text("avatar_data"),
  avatarContentType: text("avatar_content_type"),
  avatarFetchedAt: timestamp("avatar_fetched_at", { withTimezone: true }),
});

export const videos = pgTable(
  "videos",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    thumbnailUrl: text("thumbnail_url").notNull(),
    embeddable: boolean("embeddable").notNull().default(true),
    isShort: boolean("is_short").notNull().default(false),
    shortsCheck: shortsCheckEnum("shorts_check").notNull(),
    shortsCheckFailures: integer("shorts_check_failures").notNull().default(0),
    isLiveRecording: boolean("is_live_recording").notNull().default(false),
    liveState: liveStateEnum("live_state").notNull(),
    inFeed: boolean("in_feed").notNull(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('portuguese', coalesce(${videos.title}, '') || ' ' || coalesce(${videos.description}, ''))`,
    ),
  },
  (t) => [
    index("videos_channel_published_idx").on(t.channelId, t.publishedAt.desc()),
    index("videos_published_idx").on(t.publishedAt.desc()),
    index("videos_search_idx").using("gin", t.searchVector),
  ],
);

export const watchState = pgTable("watch_state", {
  videoId: text("video_id")
    .primaryKey()
    .references(() => videos.id, { onDelete: "cascade" }),
  positionSeconds: integer("position_seconds").notNull().default(0),
  watched: boolean("watched").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playlists = pgTable(
  "playlists",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    isWatchLater: boolean("is_watch_later").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("playlists_single_watch_later").on(t.isWatchLater).where(sql`${t.isWatchLater} = true`)],
);

export const playlistItems = pgTable(
  "playlist_items",
  {
    playlistId: integer("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playlistId, t.videoId] })],
);
