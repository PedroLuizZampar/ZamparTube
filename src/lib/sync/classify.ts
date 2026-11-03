import { MAX_PROBE_FAILURES, SHORTS_MAX_SECONDS } from "@/lib/constants";
import type { VideoDetails } from "@/lib/youtube/client";
import type { ProbeResult } from "@/lib/youtube/shorts-probe";

export interface Classification {
  durationSeconds: number;
  shortsCheck: "not_needed" | "pending";
  liveState: "none" | "pending" | "ended";
  isLiveRecording: boolean;
}

export function classifyVideo(d: VideoDetails): Classification {
  const isLiveNowOrUpcoming = d.liveBroadcastContent !== "none";
  const isEndedLive = !isLiveNowOrUpcoming && d.liveActualEndTime !== null;
  return {
    durationSeconds: d.durationSeconds,
    shortsCheck: d.durationSeconds <= SHORTS_MAX_SECONDS ? "pending" : "not_needed",
    liveState: isLiveNowOrUpcoming ? "pending" : isEndedLive ? "ended" : "none",
    isLiveRecording: isEndedLive,
  };
}

export function applyProbeResult(
  prev: { shortsCheckFailures: number },
  r: ProbeResult,
): { shortsCheck: "ok" | "short" | "pending"; shortsCheckFailures: number; isShort: boolean } {
  if (r === "short") return { shortsCheck: "short", shortsCheckFailures: prev.shortsCheckFailures, isShort: true };
  if (r === "not_short") return { shortsCheck: "ok", shortsCheckFailures: prev.shortsCheckFailures, isShort: false };
  const failures = prev.shortsCheckFailures + 1;
  return failures >= MAX_PROBE_FAILURES
    ? { shortsCheck: "short", shortsCheckFailures: failures, isShort: true }
    : { shortsCheck: "pending", shortsCheckFailures: failures, isShort: false };
}
