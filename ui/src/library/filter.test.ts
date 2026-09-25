import { describe, expect, it } from "vitest";
import type { AssetView } from "../api";
import { applyFilter, DEFAULT_FILTER, matchesFilter } from "./filter";

function asset(partial: Partial<AssetView>): AssetView {
  return {
    id: "a",
    deviceId: "d",
    name: "IMG_0001",
    captureTime: null,
    files: [{ name: "IMG_0001.JPG", path: "DCIM/100CANON/IMG_0001.JPG", kind: "jpeg", size: 1 }],
    rating: null,
    ratingSource: null,
    imported: false,
    ...partial,
  };
}

describe("matchesFilter", () => {
  it("accepts everything with the default filter", () => {
    expect(matchesFilter(asset({ rating: 5, imported: true }), DEFAULT_FILTER)).toBe(true);
  });

  it("treats null and 0 as unrated", () => {
    const unrated = { ...DEFAULT_FILTER, rating: "unrated" as const };
    expect(matchesFilter(asset({ rating: null }), unrated)).toBe(true);
    expect(matchesFilter(asset({ rating: 0 }), unrated)).toBe(true);
    expect(matchesFilter(asset({ rating: 1 }), unrated)).toBe(false);
  });

  it("filters by minimum stars inclusively", () => {
    const min3 = { ...DEFAULT_FILTER, rating: "3" as const };
    expect(matchesFilter(asset({ rating: 2 }), min3)).toBe(false);
    expect(matchesFilter(asset({ rating: 3 }), min3)).toBe(true);
    expect(matchesFilter(asset({ rating: 5 }), min3)).toBe(true);
    expect(matchesFilter(asset({ rating: null }), min3)).toBe(false);
  });

  it("matches assets containing any selected kind", () => {
    const pair = asset({
      files: [
        { name: "a.CR3", path: "a.CR3", kind: "raw", size: 1 },
        { name: "a.JPG", path: "a.JPG", kind: "jpeg", size: 1 },
      ],
    });
    expect(matchesFilter(pair, { ...DEFAULT_FILTER, kinds: ["raw"] })).toBe(true);
    expect(matchesFilter(pair, { ...DEFAULT_FILTER, kinds: ["video", "jpeg"] })).toBe(true);
    expect(matchesFilter(pair, { ...DEFAULT_FILTER, kinds: ["video"] })).toBe(false);
  });

  it("can hide imported assets", () => {
    const f = { ...DEFAULT_FILTER, hideImported: true };
    expect(matchesFilter(asset({ imported: true }), f)).toBe(false);
    expect(matchesFilter(asset({ imported: false }), f)).toBe(true);
  });
});

describe("applyFilter", () => {
  it("keeps order", () => {
    const list = [asset({ id: "1", rating: 4 }), asset({ id: "2", rating: 1 }), asset({ id: "3", rating: 5 })];
    expect(applyFilter(list, { ...DEFAULT_FILTER, rating: "4" }).map((a) => a.id)).toEqual(["1", "3"]);
  });
});
