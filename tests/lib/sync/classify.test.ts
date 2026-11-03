import { describe, expect, it } from "vitest";
import { applyProbeResult, classifyVideo } from "@/lib/sync/classify";
import { daysAgo, vid } from "../../helpers/fake-youtube";

describe("classifyVideo", () => {
  it("long regular video → not_needed / none", () => {
    expect(classifyVideo(vid("a", { durationSeconds: 600 }))).toEqual({
      durationSeconds: 600,
      shortsCheck: "not_needed",
      liveState: "none",
      isLiveRecording: false,
    });
  });

  it("180s video → pending (boundary inclusive)", () => {
    expect(classifyVideo(vid("a", { durationSeconds: 180 })).shortsCheck).toBe("pending");
  });

  it("181s video → not_needed", () => {
    expect(classifyVideo(vid("a", { durationSeconds: 181 })).shortsCheck).toBe("not_needed");
  });

  it("upcoming live (P0D) → liveState pending", () => {
    const c = classifyVideo(vid("a", { durationSeconds: 0, liveBroadcastContent: "upcoming" }));
    expect(c.liveState).toBe("pending");
    expect(c.isLiveRecording).toBe(false);
  });

  it("live now → liveState pending", () => {
    expect(classifyVideo(vid("a", { liveBroadcastContent: "live" })).liveState).toBe("pending");
  });

  it("ended live → ended + isLiveRecording", () => {
    const c = classifyVideo(vid("a", { durationSeconds: 5400, liveActualEndTime: daysAgo(1) }));
    expect(c).toMatchObject({ liveState: "ended", isLiveRecording: true, shortsCheck: "not_needed" });
  });
});

describe("applyProbeResult", () => {
  it("short → short + isShort", () => {
    expect(applyProbeResult({ shortsCheckFailures: 0 }, "short")).toEqual({
      shortsCheck: "short",
      shortsCheckFailures: 0,
      isShort: true,
    });
  });

  it("not_short → ok", () => {
    expect(applyProbeResult({ shortsCheckFailures: 2 }, "not_short")).toEqual({
      shortsCheck: "ok",
      shortsCheckFailures: 2,
      isShort: false,
    });
  });

  it("unknown 4x stays pending, 5th becomes short", () => {
    let state = { shortsCheckFailures: 0 };
    for (let i = 1; i <= 4; i++) {
      const r = applyProbeResult(state, "unknown");
      expect(r).toEqual({ shortsCheck: "pending", shortsCheckFailures: i, isShort: false });
      state = r;
    }
    expect(applyProbeResult(state, "unknown")).toEqual({ shortsCheck: "short", shortsCheckFailures: 5, isShort: true });
  });
});

describe("classifyVideo — ended live without duration yet", () => {
  it("ended live reporting 0s stays pending", () => {
    expect(classifyVideo(vid("a", { durationSeconds: 0, liveActualEndTime: daysAgo(0) })).liveState).toBe("pending");
  });
});
