import { describe, expect, it } from "vitest";
import { MAX_PAGE_LIMIT, canLoadMore, pageLimit } from "@/lib/paging";

describe("pageLimit", () => {
  it.each([
    [undefined, 24],
    ["abc", 24],
    ["10", 24],
    ["48", 48],
    [["72", "96"], 72],
    ["999999", MAX_PAGE_LIMIT],
  ])("%j → %i", (n, out) => expect(pageLimit(n as string | string[] | undefined)).toBe(out));
});

describe("canLoadMore", () => {
  it("only while there is more and the cap is not reached", () => {
    expect(canLoadMore(true, 24)).toBe(true);
    expect(canLoadMore(false, 24)).toBe(false);
    expect(canLoadMore(true, MAX_PAGE_LIMIT)).toBe(false);
  });
});
