import { describe, expect, it } from "vitest";
import { formatDuration, formatRelative } from "@/lib/format";

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [59, "0:59"],
    [61, "1:01"],
    [600, "10:00"],
    [3723, "1:02:03"],
  ])("%i → %s", (s, out) => expect(formatDuration(s)).toBe(out));
});

describe("formatRelative", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  it.each([
    [new Date("2026-11-03T11:59:30Z"), "agora"],
    [new Date("2026-11-03T11:00:00Z"), "há 1 hora"],
    [new Date("2026-11-01T12:00:00Z"), "há 2 dias"],
    [new Date("2026-10-13T12:00:00Z"), "há 3 semanas"],
    [new Date("2026-08-03T12:00:00Z"), "há 3 meses"],
    [new Date("2024-11-03T12:00:00Z"), "há 2 anos"],
  ])("%s → %s", (d, out) => expect(formatRelative(d, now)).toBe(out));
});
