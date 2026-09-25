import { CheckboxGroup, Label } from "react-aria-components";
import type { MediaKind } from "../api";
import { Checkbox, SelectField } from "../controls";
import { useI18n } from "../i18n";
import { KIND_LABEL } from "./AssetGrid";
import { FILTER_KINDS, type AssetFilter, type RatingFilter } from "./filter";

const RATING_VALUES: RatingFilter[] = ["all", "unrated", "1", "2", "3", "4", "5"];

interface FilterBarProps {
  filter: AssetFilter;
  onChange: (filter: AssetFilter) => void;
  shown: number;
  total: number;
  selected: number;
}

export function FilterBar({ filter, onChange, shown, total, selected }: FilterBarProps) {
  const { t } = useI18n();

  return (
    <div className="filter-bar" role="search" aria-label={t.filter}>
      <SelectField
        className="inline"
        label={t.rating}
        value={filter.rating}
        options={RATING_VALUES.map((v) => ({ value: v, label: t.ratingFilter[v]! }))}
        onChange={(rating) => onChange({ ...filter, rating })}
      />

      <CheckboxGroup
        className="kind-filter"
        value={filter.kinds}
        onChange={(kinds) => onChange({ ...filter, kinds: kinds as MediaKind[] })}
      >
        <Label>{t.type}</Label>
        {FILTER_KINDS.map((kind) => (
          <Checkbox key={kind} value={kind} className="chip">
            {KIND_LABEL[kind]}
          </Checkbox>
        ))}
      </CheckboxGroup>

      <Checkbox
        className="chip"
        isSelected={filter.hideImported}
        onChange={(hideImported) => onChange({ ...filter, hideImported })}
      >
        {t.hideImported}
      </Checkbox>

      <output className="filter-count" aria-live="polite">
        {t.count(shown, total, selected)}
      </output>
    </div>
  );
}
