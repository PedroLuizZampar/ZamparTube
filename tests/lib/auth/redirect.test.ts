import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it.each([
    ["/channels", "/channels"],
    ["/watch/abc?list=2#t", "/watch/abc?list=2#t"],
  ])("keeps same-site path %s", (input, out) => expect(safeNextPath(input)).toBe(out));

  it.each(["", "channels", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "javascript:alert(1)"])(
    "rejects %j",
    (input) => expect(safeNextPath(input)).toBe("/"),
  );
});
