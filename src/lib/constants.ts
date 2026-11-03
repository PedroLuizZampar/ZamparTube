/** Videos at or under this length may be Shorts and must pass the probe before being shown. */
export const SHORTS_MAX_SECONDS = 180;
/** After this many inconclusive probes a video is treated as a Short (hidden for good). */
export const MAX_PROBE_FAILURES = 5;
/** Set to false to skip the probe entirely: every video <= SHORTS_MAX_SECONDS stays hidden. */
export const SHORTS_PROBE_ENABLED = true;
/** On a channel's first import, only videos published in this window enter the feed. */
export const FEED_WINDOW_DAYS = 30;
/** Fraction of the duration after which a video counts as watched. */
export const WATCHED_RATIO = 0.9;
/** How often the player saves the playback position while playing. */
export const PROGRESS_SAVE_INTERVAL_MS = 10_000;
/** Max playlistItems pages read per playlist per sync run (50 videos each). */
export const MAX_PAGES_PER_RUN = 20;
/** Max shorts probes per channel per sync run. */
export const MAX_PROBES_PER_RUN = 50;
/** Default page size for video grids ("Carregar mais" adds this many). */
export const PAGE_SIZE = 24;
