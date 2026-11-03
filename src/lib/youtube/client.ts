import "server-only";
import { parseIsoDuration, type ChannelRef } from "./parse";

const BASE = "https://www.googleapis.com/youtube/v3";
const MAX_IDS_PER_CALL = 50;

export interface ChannelInfo {
  id: string;
  title: string;
  handle: string | null;
  avatarUrl: string;
}

export interface VideoDetails {
  id: string;
  channelId: string;
  title: string;
  description: string;
  publishedAt: Date;
  durationSeconds: number;
  thumbnailUrl: string;
  embeddable: boolean;
  liveBroadcastContent: "none" | "live" | "upcoming";
  liveActualEndTime: Date | null;
}

export interface YouTubeClient {
  getChannel(ref: ChannelRef): Promise<ChannelInfo | null>;
  listPlaylistPage(playlistId: string, pageToken?: string): Promise<{ videoIds: string[]; nextPageToken?: string }>;
  /** Splits into batches of 50. Ids the API does not return (deleted/private) are simply absent. */
  getVideos(ids: string[]): Promise<VideoDetails[]>;
}

export class YouTubeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

export const isPlaylistNotFound = (e: unknown): boolean =>
  e instanceof YouTubeApiError && (e.reason === "playlistNotFound" || e.status === 404);

export const isQuotaExceeded = (e: unknown): boolean =>
  e instanceof YouTubeApiError && (e.reason === "quotaExceeded" || e.reason === "dailyLimitExceeded");

type Thumbs = Record<string, { url: string } | undefined>;

interface ApiVideo {
  id: string;
  snippet: {
    channelId: string;
    title: string;
    description?: string;
    publishedAt: string;
    liveBroadcastContent?: string;
    thumbnails?: Thumbs;
  };
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean };
  liveStreamingDetails?: { actualEndTime?: string };
}

const pickThumb = (t: Thumbs | undefined, order: string[]) => order.map((k) => t?.[k]?.url).find(Boolean) ?? "";

export function createYouTubeClient(apiKey: string, fetchFn: typeof fetch = fetch): YouTubeClient {
  async function call<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
    const url = new URL(`${BASE}/${path}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
    url.searchParams.set("key", apiKey);
    const res = await fetchFn(url, { cache: "no-store" });
    const body = (await res.json().catch(() => undefined)) as
      | { error?: { message?: string; errors?: { reason?: string }[] } }
      | undefined;
    if (res.ok && body === undefined) {
      // Never read an unparseable success as "no items": the sync would delete videos.
      throw new YouTubeApiError(res.status, "invalidResponse", "YouTube API returned a non-JSON response");
    }
    if (!res.ok || !body) {
      const reason = body?.error?.errors?.[0]?.reason ?? "unknown";
      throw new YouTubeApiError(res.status, reason, body?.error?.message ?? `YouTube API ${res.status}`);
    }
    return body as T;
  }

  return {
    async getChannel(ref) {
      const params =
        ref.kind === "id" ? { part: "snippet", id: ref.id } : { part: "snippet", forHandle: `@${ref.handle}` };
      const data = await call<{
        items?: { id: string; snippet: { title: string; customUrl?: string; thumbnails?: Thumbs } }[];
      }>("channels", params);
      const item = data.items?.[0];
      if (!item) return null;
      return {
        id: item.id,
        title: item.snippet.title,
        handle: item.snippet.customUrl ?? null,
        avatarUrl: pickThumb(item.snippet.thumbnails, ["medium", "high", "default"]),
      };
    },

    async listPlaylistPage(playlistId, pageToken) {
      const data = await call<{ nextPageToken?: string; items?: { contentDetails: { videoId: string } }[] }>(
        "playlistItems",
        { part: "contentDetails", playlistId, maxResults: "50", pageToken },
      );
      return {
        videoIds: (data.items ?? []).map((i) => i.contentDetails.videoId),
        ...(data.nextPageToken ? { nextPageToken: data.nextPageToken } : {}),
      };
    },

    async getVideos(ids) {
      const out: VideoDetails[] = [];
      for (let i = 0; i < ids.length; i += MAX_IDS_PER_CALL) {
        const batch = ids.slice(i, i + MAX_IDS_PER_CALL);
        const data = await call<{ items?: ApiVideo[] }>("videos", {
          part: "snippet,contentDetails,status,liveStreamingDetails",
          id: batch.join(","),
          maxResults: "50",
        });
        for (const v of data.items ?? []) out.push(mapVideo(v));
      }
      return out;
    },
  };
}

function mapVideo(v: ApiVideo): VideoDetails {
  const lbc = v.snippet.liveBroadcastContent;
  const end = v.liveStreamingDetails?.actualEndTime;
  return {
    id: v.id,
    channelId: v.snippet.channelId,
    title: v.snippet.title,
    description: v.snippet.description ?? "",
    publishedAt: new Date(v.snippet.publishedAt),
    durationSeconds: parseIsoDuration(v.contentDetails?.duration ?? "P0D"),
    thumbnailUrl: pickThumb(v.snippet.thumbnails, ["maxres", "high", "medium", "default"]),
    embeddable: v.status?.embeddable ?? true,
    liveBroadcastContent: lbc === "live" || lbc === "upcoming" ? lbc : "none",
    liveActualEndTime: end ? new Date(end) : null,
  };
}
