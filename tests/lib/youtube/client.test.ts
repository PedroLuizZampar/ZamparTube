import { describe, expect, it } from "vitest";
import { createYouTubeClient, isPlaylistNotFound, isQuotaExceeded, YouTubeApiError } from "@/lib/youtube/client";

type Handler = (url: URL) => { status?: number; body: unknown };

function fakeFetch(handler: Handler) {
  const calls: URL[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    const { status = 200, body } = handler(url);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fn, calls };
}

const apiError = (status: number, reason: string) => ({
  status,
  body: { error: { code: status, message: reason, errors: [{ reason }] } },
});

function videoItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    snippet: {
      channelId: "UCx",
      title: `T ${id}`,
      description: "d",
      publishedAt: "2026-10-01T10:00:00Z",
      liveBroadcastContent: "none",
      thumbnails: { high: { url: `https://i.ytimg.com/vi/${id}/hq.jpg` } },
    },
    contentDetails: { duration: "PT10M" },
    status: { embeddable: true },
    ...overrides,
  };
}

describe("YouTube client", () => {
  it("getChannel by handle calls channels.list?forHandle and maps fields", async () => {
    const { fn, calls } = fakeFetch(() => ({
      body: {
        items: [
          {
            id: "UC123",
            snippet: {
              title: "Canal",
              customUrl: "@canal",
              thumbnails: { default: { url: "a" }, medium: { url: "b" } },
            },
          },
        ],
      },
    }));
    const yt = createYouTubeClient("KEY", fn);
    const ch = await yt.getChannel({ kind: "handle", handle: "canal" });
    expect(ch).toEqual({ id: "UC123", title: "Canal", handle: "@canal", avatarUrl: "b" });
    expect(calls[0].pathname).toBe("/youtube/v3/channels");
    expect(calls[0].searchParams.get("forHandle")).toBe("@canal");
    expect(calls[0].searchParams.get("key")).toBe("KEY");
    expect(calls[0].searchParams.get("part")).toBe("snippet");
  });

  it("getChannel by id uses id param", async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { items: [] } }));
    await createYouTubeClient("KEY", fn).getChannel({ kind: "id", id: "UC9" });
    expect(calls[0].searchParams.get("id")).toBe("UC9");
  });

  it("getChannel returns null when items is empty or missing", async () => {
    const { fn } = fakeFetch(() => ({ body: {} }));
    expect(await createYouTubeClient("KEY", fn).getChannel({ kind: "handle", handle: "nada" })).toBeNull();
  });

  it("listPlaylistPage maps contentDetails.videoId and nextPageToken", async () => {
    const { fn, calls } = fakeFetch(() => ({
      body: { nextPageToken: "NEXT", items: [{ contentDetails: { videoId: "a" } }, { contentDetails: { videoId: "b" } }] },
    }));
    const page = await createYouTubeClient("KEY", fn).listPlaylistPage("UULFx", "TOKEN");
    expect(page).toEqual({ videoIds: ["a", "b"], nextPageToken: "NEXT" });
    expect(calls[0].pathname).toBe("/youtube/v3/playlistItems");
    expect(calls[0].searchParams.get("playlistId")).toBe("UULFx");
    expect(calls[0].searchParams.get("maxResults")).toBe("50");
    expect(calls[0].searchParams.get("pageToken")).toBe("TOKEN");
    expect(calls[0].searchParams.get("part")).toBe("contentDetails");
  });

  it("getVideos batches 120 ids into 3 calls with the needed parts", async () => {
    const { fn, calls } = fakeFetch((url) => ({
      body: { items: (url.searchParams.get("id") ?? "").split(",").map((id) => videoItem(id)) },
    }));
    const ids = Array.from({ length: 120 }, (_, i) => `v${i}`);
    const vids = await createYouTubeClient("KEY", fn).getVideos(ids);
    expect(calls).toHaveLength(3);
    expect(calls[0].searchParams.get("id")!.split(",")).toHaveLength(50);
    expect(calls[2].searchParams.get("id")!.split(",")).toHaveLength(20);
    expect(calls[0].searchParams.get("part")).toBe("snippet,contentDetails,status,liveStreamingDetails");
    expect(vids).toHaveLength(120);
    expect(vids[0]).toEqual({
      id: "v0",
      channelId: "UCx",
      title: "T v0",
      description: "d",
      publishedAt: new Date("2026-10-01T10:00:00Z"),
      durationSeconds: 600,
      thumbnailUrl: "https://i.ytimg.com/vi/v0/hq.jpg",
      embeddable: true,
      liveBroadcastContent: "none",
      liveActualEndTime: null,
    });
  });

  it("getVideos with no ids makes no call", async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { items: [] } }));
    expect(await createYouTubeClient("KEY", fn).getVideos([])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("getVideos maps an upcoming live (P0D) and an ended live", async () => {
    const { fn } = fakeFetch(() => ({
      body: {
        items: [
          videoItem("up", {
            contentDetails: { duration: "P0D" },
            snippet: { ...videoItem("up").snippet, liveBroadcastContent: "upcoming" },
            liveStreamingDetails: { scheduledStartTime: "2026-12-01T00:00:00Z" },
          }),
          videoItem("ended", { liveStreamingDetails: { actualEndTime: "2026-10-02T00:00:00Z" } }),
        ],
      },
    }));
    const [up, ended] = await createYouTubeClient("KEY", fn).getVideos(["up", "ended"]);
    expect(up).toMatchObject({ durationSeconds: 0, liveBroadcastContent: "upcoming", liveActualEndTime: null });
    expect(ended.liveActualEndTime).toEqual(new Date("2026-10-02T00:00:00Z"));
  });

  it("throws YouTubeApiError with status and reason", async () => {
    const { fn } = fakeFetch(() => apiError(403, "quotaExceeded"));
    const err = await createYouTubeClient("KEY", fn).listPlaylistPage("x").catch((e) => e);
    expect(err).toBeInstanceOf(YouTubeApiError);
    expect(err).toMatchObject({ status: 403, reason: "quotaExceeded" });
    expect(isQuotaExceeded(err)).toBe(true);
    expect(isPlaylistNotFound(err)).toBe(false);
  });

  it("isPlaylistNotFound true for 404 playlistNotFound", async () => {
    const { fn } = fakeFetch(() => apiError(404, "playlistNotFound"));
    const err = await createYouTubeClient("KEY", fn).listPlaylistPage("x").catch((e) => e);
    expect(isPlaylistNotFound(err)).toBe(true);
    expect(isQuotaExceeded(err)).toBe(false);
  });

  it("isQuotaExceeded true for dailyLimitExceeded and false for random errors", () => {
    expect(isQuotaExceeded(new YouTubeApiError(403, "dailyLimitExceeded", "x"))).toBe(true);
    expect(isQuotaExceeded(new Error("boom"))).toBe(false);
  });
});
