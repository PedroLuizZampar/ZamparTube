import { and, eq, inArray, type SQL } from "drizzle-orm";
import { videos } from "@/lib/db/schema";

/**
 * The single rule for "may this video be shown anywhere in the app".
 * Shorts, videos still waiting for the Shorts probe, lives not yet finished and live recordings are hidden.
 */
export function visibleVideoCondition(): SQL {
  return and(
    eq(videos.isShort, false),
    inArray(videos.shortsCheck, ["not_needed", "ok"]),
    inArray(videos.liveState, ["none", "ended"]),
    eq(videos.isLiveRecording, false),
  )!;
}
