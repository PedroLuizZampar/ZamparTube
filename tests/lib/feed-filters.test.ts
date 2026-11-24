import { describe, expect, it } from "vitest";
import { feedHref, filterParams, parseFeedFilters, toggleCategory } from "@/lib/feed-filters";

const channels = [
  { id: "UCa", categoryIds: [1] },
  { id: "UCb", categoryIds: [3] },
  { id: "UCc", categoryIds: [] },
  { id: "UCd", categoryIds: [1, 3] },
];
const valid = { categoryIds: [1, 2, 3], channels };

describe("parseFeedFilters", () => {
  it("splits on commas and drops empty, unknown and duplicate ids", () => {
    expect(parseFeedFilters({ categoria: "1,,3,999,1", canal: "UCa,xyz,UCa" }, valid)).toEqual({
      categoryIds: [1, 3],
      channelIds: ["UCa"],
    });
  });

  it("keeps the order of the valid lists", () => {
    expect(parseFeedFilters({ categoria: "3,1", canal: "UCb,UCa" }, valid)).toEqual({
      categoryIds: [1, 3],
      channelIds: ["UCa", "UCb"],
    });
  });

  it("uses the first element of an array param", () => {
    expect(parseFeedFilters({ categoria: ["2", "1"] }, valid)).toEqual({ categoryIds: [2], channelIds: [] });
  });

  it("drops channels outside the selected categories", () => {
    expect(parseFeedFilters({ categoria: "1", canal: "UCa,UCb,UCc" }, valid)).toEqual({
      categoryIds: [1],
      channelIds: ["UCa"],
    });
  });

  it("keeps a channel that is in any of the selected categories", () => {
    expect(parseFeedFilters({ categoria: "3", canal: "UCa,UCd" }, valid)).toEqual({
      categoryIds: [3],
      channelIds: ["UCd"],
    });
  });

  it("is empty for missing or garbage params", () => {
    expect(parseFeedFilters({}, valid)).toEqual({ categoryIds: [], channelIds: [] });
    expect(parseFeedFilters({ categoria: "abc", canal: "" }, valid)).toEqual({ categoryIds: [], channelIds: [] });
  });
});

describe("feedHref", () => {
  it("is / without filters", () => {
    expect(feedHref({ categoryIds: [], channelIds: [] })).toBe("/");
  });

  it("joins ids with plain commas and skips empty params", () => {
    expect(feedHref({ categoryIds: [1, 3], channelIds: ["UCa"] })).toBe("/?categoria=1,3&canal=UCa");
    expect(feedHref({ categoryIds: [], channelIds: ["UCa", "UCb"] })).toBe("/?canal=UCa,UCb");
  });
});

describe("feedHref with a base path", () => {
  it("builds the URL on the given page", () => {
    expect(feedHref({ categoryIds: [1], channelIds: [] }, "/history")).toBe("/history?categoria=1");
    expect(feedHref({ categoryIds: [], channelIds: [] }, "/history")).toBe("/history");
  });
});

describe("toggleCategory", () => {
  it("adds and removes a category, keeping the valid order", () => {
    expect(toggleCategory({ categoryIds: [3], channelIds: [] }, 1, channels)).toEqual({
      categoryIds: [1, 3],
      channelIds: [],
    });
    expect(toggleCategory({ categoryIds: [1, 3], channelIds: [] }, 1, channels)).toEqual({
      categoryIds: [3],
      channelIds: [],
    });
  });

  it("drops selected channels outside the new category set", () => {
    expect(toggleCategory({ categoryIds: [1, 3], channelIds: ["UCa", "UCb"] }, 3, channels)).toEqual({
      categoryIds: [1],
      channelIds: ["UCa"],
    });
  });

  it("keeps every channel when the last category is removed", () => {
    expect(toggleCategory({ categoryIds: [1], channelIds: ["UCa"] }, 1, channels)).toEqual({
      categoryIds: [],
      channelIds: ["UCa"],
    });
  });
});

describe("filterParams", () => {
  it("returns only the non-empty filters as search params", () => {
    expect(filterParams({ categoryIds: [], channelIds: [] })).toEqual({});
    expect(filterParams({ categoryIds: [1, 3], channelIds: ["UCa"] })).toEqual({ categoria: "1,3", canal: "UCa" });
  });
});
