import { describe, expect, it } from "vitest";
import {
  livesPlaylistId,
  longVideosPlaylistId,
  parseChannelInput,
  parseIsoDuration,
  uploadsPlaylistId,
} from "@/lib/youtube/parse";

const ID = "UCabcdefghijklmnopqrstuv";

describe("parseChannelInput", () => {
  it.each([
    ["@canal_x", { kind: "handle", handle: "canal_x" }],
    ["  @canal.x-1  ", { kind: "handle", handle: "canal.x-1" }],
    ["https://www.youtube.com/@canal_x/videos", { kind: "handle", handle: "canal_x" }],
    ["m.youtube.com/@canal_x?si=abc", { kind: "handle", handle: "canal_x" }],
    ["youtube.com/@canal_x", { kind: "handle", handle: "canal_x" }],
    [ID, { kind: "id", id: ID }],
    [`https://youtube.com/channel/${ID}?si=1`, { kind: "id", id: ID }],
    [`https://www.youtube.com/channel/${ID}/videos`, { kind: "id", id: ID }],
  ])("parses %s", (input, ref) => {
    expect(parseChannelInput(input)).toEqual({ ok: true, ref });
  });

  it.each(["https://www.youtube.com/c/Nome", "https://www.youtube.com/user/Nome"])(
    "rejects legacy URL %s with guidance to use @",
    (input) => {
      const r = parseChannelInput(input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/@/);
    },
  );

  it.each(["  ", "https://www.youtube.com/watch?v=abc", "https://example.com/@x", "@a"])("rejects %s", (input) => {
    expect(parseChannelInput(input).ok).toBe(false);
  });
});

describe("parseIsoDuration", () => {
  it.each([
    ["PT1H2M3S", 3723],
    ["PT59S", 59],
    ["PT3M", 180],
    ["P0D", 0],
    ["P1DT1S", 86401],
  ])("%s → %i", (iso, s) => expect(parseIsoDuration(iso)).toBe(s));
});

describe("playlist ids", () => {
  it("derives playlist ids from the channel id", () => {
    expect(longVideosPlaylistId("UCabc")).toBe("UULFabc");
    expect(livesPlaylistId("UCabc")).toBe("UULVabc");
    expect(uploadsPlaylistId("UCabc")).toBe("UUabc");
  });
});

describe("parseChannelInput — review 1 fixes", () => {
  it("accepts accented handles", () => {
    expect(parseChannelInput("https://www.youtube.com/@canalção")).toEqual({
      ok: true,
      ref: { kind: "handle", handle: "canalção" },
    });
    expect(parseChannelInput("https://www.youtube.com/@canal%C3%A7%C3%A3o")).toEqual({
      ok: true,
      ref: { kind: "handle", handle: "canalção" },
    });
  });

  it("returns an error instead of throwing on malformed percent-encoding", () => {
    expect(parseChannelInput("youtube.com/@abc%").ok).toBe(false);
  });
});
