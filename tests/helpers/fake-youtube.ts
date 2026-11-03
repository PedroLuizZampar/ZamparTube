import { YouTubeApiError, type ChannelInfo, type VideoDetails, type YouTubeClient } from "@/lib/youtube/client";
import type { ChannelRef } from "@/lib/youtube/parse";

export interface FakeYouTubeOptions {
  channels?: ChannelInfo[];
  /** playlistId → video ids, newest first (like the real API). */
  playlists?: Record<string, string[]>;
  videos?: Record<string, VideoDetails>;
  /** Playlists that answer 404 playlistNotFound. */
  missingPlaylists?: string[];
  /** Playlists that answer 500 backendError. */
  failingPlaylists?: string[];
  /** Every call after this many answers 403 quotaExceeded. */
  quotaAfterCalls?: number;
}

export type FakeCall =
  | { method: "getChannel"; ref: ChannelRef }
  | { method: "listPlaylistPage"; playlistId: string; pageToken?: string }
  | { method: "getVideos"; ids: string[] };

export interface FakeYouTube extends YouTubeClient {
  calls: FakeCall[];
  playlists: Record<string, string[]>;
  videos: Record<string, VideoDetails>;
  missingPlaylists: string[];
}

const PAGE = 50;

export function createFakeYouTube(opts: FakeYouTubeOptions = {}): FakeYouTube {
  const fake: FakeYouTube = {
    calls: [],
    playlists: opts.playlists ?? {},
    videos: opts.videos ?? {},
    missingPlaylists: opts.missingPlaylists ?? [],

    async getChannel(ref) {
      track({ method: "getChannel", ref });
      return (
        (opts.channels ?? []).find((c) =>
          ref.kind === "id" ? c.id === ref.id : c.handle?.replace(/^@/, "") === ref.handle,
        ) ?? null
      );
    },

    async listPlaylistPage(playlistId, pageToken) {
      track({ method: "listPlaylistPage", playlistId, pageToken });
      if (fake.missingPlaylists.includes(playlistId)) throw new YouTubeApiError(404, "playlistNotFound", "nf");
      if (opts.failingPlaylists?.includes(playlistId)) throw new YouTubeApiError(500, "backendError", "boom");
      const all = fake.playlists[playlistId];
      if (!all) throw new YouTubeApiError(404, "playlistNotFound", "nf");
      const offset = pageToken ? Number(pageToken) : 0;
      const videoIds = all.slice(offset, offset + PAGE);
      const next = offset + PAGE < all.length ? String(offset + PAGE) : undefined;
      return next ? { videoIds, nextPageToken: next } : { videoIds };
    },

    async getVideos(ids) {
      track({ method: "getVideos", ids: [...ids] });
      return ids.map((id) => fake.videos[id]).filter((v): v is VideoDetails => Boolean(v));
    },
  };

  function track(call: FakeCall) {
    fake.calls.push(call);
    if (opts.quotaAfterCalls !== undefined && fake.calls.length > opts.quotaAfterCalls) {
      throw new YouTubeApiError(403, "quotaExceeded", "quota");
    }
  }

  return fake;
}

export const NOW = new Date("2026-11-03T12:00:00Z");

export function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

export function vid(id: string, overrides: Partial<VideoDetails> = {}): VideoDetails {
  return {
    id,
    channelId: "UCaaaaaaaaaaaaaaaaaaaaaa",
    title: `Vídeo ${id}`,
    description: "",
    publishedAt: daysAgo(1),
    durationSeconds: 600,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hq.jpg`,
    embeddable: true,
    liveBroadcastContent: "none",
    liveActualEndTime: null,
    ...overrides,
  };
}
