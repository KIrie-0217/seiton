import { useId } from "react";
import type { MediaKind } from "../api";
import { KIND_LABEL } from "./AssetGrid";
import { FILTER_KINDS, type AssetFilter, type RatingFilter } from "./filter";

const RATING_OPTIONS: { value: RatingFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "unrated", label: "未評価のみ" },
  { value: "1", label: "★1 以上" },
  { value: "2", label: "★2 以上" },
  { value: "3", label: "★3 以上" },
  { value: "4", label: "★4 以上" },
  { value: "5", label: "★5" },
];

interface FilterBarProps {
  filter: AssetFilter;
  onChange: (filter: AssetFilter) => void;
  shown: number;
  total: number;
  selected: number;
}

export function FilterBar({ filter, onChange, shown, total, selected }: FilterBarProps) {
  const ratingId = useId();

  function toggleKind(kind: MediaKind, on: boolean) {
    const kinds = on ? [...filter.kinds, kind] : filter.kinds.filter((k) => k !== kind);
    onChange({ ...filter, kinds });
  }

  return (
    <div className="filter-bar" role="search" aria-label="絞り込み">
      <label htmlFor={ratingId}>評価</label>
      <select
        id={ratingId}
        value={filter.rating}
        onChange={(e) => onChange({ ...filter, rating: e.target.value as RatingFilter })}
      >
        {RATING_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <fieldset className="kind-filter">
        <legend>種類</legend>
        {FILTER_KINDS.map((kind) => (
          <label key={kind}>
            <input
              type="checkbox"
              checked={filter.kinds.includes(kind)}
              onChange={(e) => toggleKind(kind, e.target.checked)}
            />
            {KIND_LABEL[kind]}
          </label>
        ))}
      </fieldset>

      <label>
        <input
          type="checkbox"
          checked={filter.hideImported}
          onChange={(e) => onChange({ ...filter, hideImported: e.target.checked })}
        />
        取込済みを隠す
      </label>

      <output className="filter-count" aria-live="polite">
        {shown} / {total} 件{selected > 0 && `（${selected} 件選択）`}
      </output>
    </div>
  );
}
