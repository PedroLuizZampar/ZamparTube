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

/** Optional picture uploaded by the user (base64), served by /category-image/[id] and /playlist-image/[id]. */
const imageColumns = () => ({
  imageData: text("image_data"),
  imageContentType: text("image_content_type"),
  imageUpdatedAt: timestamp("image_updated_at", { withTimezone: true }),
});

/**
 * App accounts. A row with a null password hash is the placeholder owner created by migration 0007 for the data that
 * existed before accounts: the first account created takes it over (and with it, everything it owns).
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Profile photo (base64), served to its owner by /profile-image. */
    ...imageColumns(),
  },
  // Usernames are unique ignoring case.
  (t) => [uniqueIndex("users_username_lower_unique").on(sql`lower(${t.username})`)],
);

const userId = () =>
  integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    userId: userId(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    /** Channels in a hidden category only show on the home feed when filtered by that category or by the channel. */
    hiddenFromHome: boolean("hidden_from_home").notNull().default(false),
    ...imageColumns(),
  },
  // Names are unique per user ignoring case ("Música" and "música" cannot coexist).
  (t) => [uniqueIndex("categories_user_name_lower_unique").on(t.userId, sql`lower(${t.name})`)],
);

export const channels = pgTable("channels", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  handle: text("handle"),
  avatarUrl: text("avatar_url").notNull(),
  uploadsPlaylistId: text("uploads_playlist_id").notNull(),
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

/**
 * Which user follows which channel. Channels and videos are shared (synced once); a channel is synced while
 * someone follows it (`channels.removed_at` is set when the last follower leaves).
 */
export const userChannels = pgTable(
  "user_channels",
  {
    userId: userId(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.channelId] }), index("user_channels_channel_idx").on(t.channelId)],
);

/** A channel can be in several categories (categories belong to a user). */
export const channelCategories = pgTable(
  "channel_categories",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.categoryId] }), index("channel_categories_category_idx").on(t.categoryId)],
);

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

export const watchState = pgTable(
  "watch_state",
  {
    userId: userId(),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    positionSeconds: integer("position_seconds").notNull().default(0),
    watched: boolean("watched").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.videoId] })],
);

/** Videos a user took out of their feed without watching them. */
export const feedDismissals = pgTable(
  "feed_dismissals",
  {
    userId: userId(),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.videoId] })],
);

export const playlists = pgTable(
  "playlists",
  {
    id: serial("id").primaryKey(),
    userId: userId(),
    name: text("name").notNull(),
    isWatchLater: boolean("is_watch_later").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...imageColumns(),
  },
  (t) => [
    uniqueIndex("playlists_single_watch_later").on(t.userId).where(sql`${t.isWatchLater} = true`),
    // Names are unique per user ignoring case ("Estudos" and "estudos" cannot coexist).
    uniqueIndex("playlists_user_name_lower_unique").on(t.userId, sql`lower(${t.name})`),
  ],
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

/**
 * The play queue. Rows with `playedAt` null are the upcoming videos (by `position`); played rows are a hidden
 * stack (newest first) that only the "previous" button walks back through.
 */
export const queueItems = pgTable(
  "queue_items",
  {
    userId: userId(),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.videoId] }), index("queue_items_user_played_idx").on(t.userId, t.playedAt)],
);
