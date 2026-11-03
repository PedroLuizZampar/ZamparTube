import { describe, expect, it } from "vitest";
import { probeShort } from "@/lib/youtube/shorts-probe";

function respond(status: number, headers: Record<string, string> = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(null, { status, headers });
  }) as typeof fetch;
  return { fn, calls };
}

describe("probeShort", () => {
  it("200 → short", async () => {
    expect(await probeShort("abc", respond(200).fn)).toBe("short");
  });

  it("303 to /watch → not_short", async () => {
    const { fn } = respond(303, { location: "https://www.youtube.com/watch?v=abc" });
    expect(await probeShort("abc", fn)).toBe("not_short");
  });

  it("303 to relative /watch → not_short", async () => {
    const { fn } = respond(303, { location: "/watch?v=abc" });
    expect(await probeShort("abc", fn)).toBe("not_short");
  });

  it("302 to consent.youtube.com → unknown", async () => {
    const { fn } = respond(302, { location: "https://consent.youtube.com/m?continue=x" });
    expect(await probeShort("abc", fn)).toBe("unknown");
  });

  it("429 → unknown", async () => {
    expect(await probeShort("abc", respond(429).fn)).toBe("unknown");
  });

  it("network error → unknown", async () => {
    const fn = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect(await probeShort("abc", fn)).toBe("unknown");
  });

  it("requests /shorts/{id} without following redirects", async () => {
    const { fn, calls } = respond(200);
    await probeShort("xyz", fn);
    expect(calls[0].url).toBe("https://www.youtube.com/shorts/xyz");
    expect(calls[0].init?.redirect).toBe("manual");
  });
});
