import type { AssetView, MediaKind } from "../api";

/** `all`, only unrated, or "at least N stars". */
export type RatingFilter = "all" | "unrated" | "1" | "2" | "3" | "4" | "5";

export interface AssetFilter {
  rating: RatingFilter;
  /** Show assets containing any of these kinds; empty means all kinds. */
  kinds: MediaKind[];
  hideImported: boolean;
}

export const DEFAULT_FILTER: AssetFilter = { rating: "all", kinds: [], hideImported: false };

/** Kinds offered in the filter UI (sidecars are not shots on their own). */
export const FILTER_KINDS: MediaKind[] = ["raw", "jpeg", "heif", "video"];

/** Ratings of 0 and `null` are both shown as "unrated". */
export function starsOf(asset: AssetView): number {
  return asset.rating ?? 0;
}

export function matchesFilter(asset: AssetView, filter: AssetFilter): boolean {
  if (filter.hideImported && asset.imported) return false;
  if (filter.kinds.length > 0 && !asset.files.some((f) => filter.kinds.includes(f.kind))) return false;
  const stars = starsOf(asset);
  switch (filter.rating) {
    case "all":
      return true;
    case "unrated":
      return stars === 0;
    default:
      return stars >= Number(filter.rating);
  }
}

export function applyFilter(assets: AssetView[], filter: AssetFilter): AssetView[] {
  return assets.filter((a) => matchesFilter(a, filter));
}
