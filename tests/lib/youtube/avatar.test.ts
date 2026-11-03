import { describe, expect, it } from "vitest";
import { fetchAvatarImage } from "@/lib/youtube/avatar";

const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0x02]);
const respond = (status: number, type: string, body: BodyInit | null = bytes) =>
  (async () => new Response(body, { status, headers: { "content-type": type } })) as typeof fetch;

describe("fetchAvatarImage", () => {
  it("returns base64 data and content type for an image", async () => {
    expect(await fetchAvatarImage("https://yt3.ggpht.com/x=s240", respond(200, "image/jpeg"))).toEqual({
      base64: Buffer.from(bytes).toString("base64"),
      contentType: "image/jpeg",
    });
  });

  it("returns null on 429 (Google rate limit)", async () => {
    expect(await fetchAvatarImage("https://yt3.ggpht.com/x", respond(429, "text/html"))).toBeNull();
  });

  it("returns null for non-image responses, network errors and empty urls", async () => {
    expect(await fetchAvatarImage("https://yt3.ggpht.com/x", respond(200, "text/html"))).toBeNull();
    const boom = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect(await fetchAvatarImage("https://yt3.ggpht.com/x", boom)).toBeNull();
    expect(await fetchAvatarImage("", respond(200, "image/jpeg"))).toBeNull();
  });

  it("returns null for images over 1 MB", async () => {
    expect(await fetchAvatarImage("https://yt3.ggpht.com/x", respond(200, "image/png", new Uint8Array(1_100_000)))).toBeNull();
  });
});
