/** Speeds offered in the player menu. */
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/** Seek target after jumping `delta` seconds, kept inside the video (never exactly at the end, which would end it). */
export function clampSeek(current: number, delta: number, duration: number): number {
  const target = Math.max(0, current + delta);
  return duration > 0 ? Math.min(target, duration - 0.5) : target;
}

/** Which part of the video a double tap hit: left third seeks back, right third forward. */
export function tapZone(x: number, width: number): "back" | "center" | "forward" {
  if (x < width / 3) return "back";
  if (x > (2 * width) / 3) return "forward";
  return "center";
}

export type Shortcut =
  | { type: "toggle" }
  | { type: "seek"; delta: number }
  | { type: "fullscreen" }
  | { type: "mute" }
  | { type: "next" }
  | { type: "prev" };

/** Keyboard shortcuts (same keys as YouTube's player). */
export function shortcutFor(key: string, shift = false): Shortcut | null {
  if (shift && (key === "N" || key === "n")) return { type: "next" };
  if (shift && (key === "P" || key === "p")) return { type: "prev" };
  switch (key.length === 1 ? key.toLowerCase() : key) {
    case " ":
    case "k":
      return { type: "toggle" };
    case "j":
      return { type: "seek", delta: -10 };
    case "l":
      return { type: "seek", delta: 10 };
    case "ArrowLeft":
      return { type: "seek", delta: -5 };
    case "ArrowRight":
      return { type: "seek", delta: 5 };
    case "f":
      return { type: "fullscreen" };
    case "m":
      return { type: "mute" };
    default:
      return null;
  }
}

const NON_TEXT_INPUTS = new Set(["range", "checkbox", "radio", "button", "submit", "reset", "file", "color"]);

/** True when a key press belongs to a text field, so player shortcuts must not react. */
export function isTypingTarget(
  el: { tagName: string; type?: string; isContentEditable: boolean } | null,
): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.tagName === "INPUT") return !NON_TEXT_INPUTS.has((el.type ?? "text").toLowerCase());
  return false;
}
