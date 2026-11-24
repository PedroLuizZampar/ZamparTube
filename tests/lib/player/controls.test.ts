import { describe, expect, it } from "vitest";
import { PLAYBACK_RATES, clampSeek, isTypingTarget, shortcutFor, tapZone } from "@/lib/player/controls";

describe("clampSeek", () => {
  it("keeps the target inside the video", () => {
    expect(clampSeek(50, 10, 100)).toBe(60);
    expect(clampSeek(5, -10, 100)).toBe(0);
    expect(clampSeek(95, 10, 100)).toBe(99.5);
  });

  it("does not clamp the end when the duration is unknown", () => {
    expect(clampSeek(50, 10, 0)).toBe(60);
  });
});

describe("tapZone", () => {
  it("left third goes back, right third goes forward, middle is center", () => {
    expect(tapZone(10, 300)).toBe("back");
    expect(tapZone(150, 300)).toBe("center");
    expect(tapZone(290, 300)).toBe("forward");
  });
});

describe("shortcutFor", () => {
  it("maps the player keys", () => {
    expect(shortcutFor(" ")).toEqual({ type: "toggle" });
    expect(shortcutFor("k")).toEqual({ type: "toggle" });
    expect(shortcutFor("K")).toEqual({ type: "toggle" });
    expect(shortcutFor("j")).toEqual({ type: "seek", delta: -10 });
    expect(shortcutFor("l")).toEqual({ type: "seek", delta: 10 });
    expect(shortcutFor("ArrowLeft")).toEqual({ type: "seek", delta: -5 });
    expect(shortcutFor("ArrowRight")).toEqual({ type: "seek", delta: 5 });
    expect(shortcutFor("f")).toEqual({ type: "fullscreen" });
    expect(shortcutFor("m")).toEqual({ type: "mute" });
    expect(shortcutFor("x")).toBeNull();
  });

  it("maps Shift+N / Shift+P to next / previous video", () => {
    expect(shortcutFor("N", true)).toEqual({ type: "next" });
    expect(shortcutFor("P", true)).toEqual({ type: "prev" });
    expect(shortcutFor("n")).toBeNull();
    expect(shortcutFor("p")).toBeNull();
    expect(shortcutFor("K", true)).toEqual({ type: "toggle" });
    expect(shortcutFor("c")).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("is true for text fields and editable content, false otherwise", () => {
    expect(isTypingTarget({ tagName: "INPUT", type: "text", isContentEditable: false })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA", isContentEditable: false })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT", isContentEditable: false })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT", type: "range", isContentEditable: false })).toBe(false);
    expect(isTypingTarget({ tagName: "BUTTON", isContentEditable: false })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("PLAYBACK_RATES", () => {
  it("goes from 0.5x to 2x and includes normal speed", () => {
    expect(PLAYBACK_RATES[0]).toBe(0.5);
    expect(PLAYBACK_RATES.at(-1)).toBe(2);
    expect(PLAYBACK_RATES).toContain(1);
  });
});
