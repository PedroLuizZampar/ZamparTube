import { describe, expect, it } from "vitest";
import { resumeFrom, shouldMarkWatched } from "@/lib/player/progress";

describe("shouldMarkWatched", () => {
  it("90% marks watched, 89% does not, duration 0 never", () => {
    expect(shouldMarkWatched(900, 1000)).toBe(true);
    expect(shouldMarkWatched(890, 1000)).toBe(false);
    expect(shouldMarkWatched(0, 0)).toBe(false);
    expect(shouldMarkWatched(10, 0)).toBe(false);
  });
});

describe("resumeFrom", () => {
  it("watched → 0", () => expect(resumeFrom({ positionSeconds: 300, watched: true }, 1000)).toBe(0));
  it("no state → 0", () => expect(resumeFrom(null, 1000)).toBe(0));
  it("near the end → 0", () => expect(resumeFrom({ positionSeconds: 995, watched: false }, 1000)).toBe(0));
  it("middle → floor(position)", () => expect(resumeFrom({ positionSeconds: 312.7, watched: false }, 1000)).toBe(312));
});
