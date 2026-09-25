import { useCallback, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { AssetGrid } from "./AssetGrid";
import { FilterBar } from "./FilterBar";
import { applyFilter, DEFAULT_FILTER, type AssetFilter } from "./filter";
import { useLibrary } from "./useLibrary";

/** Filter bar + contact sheet. The filter is local to each pane. */
export function ThumbnailsPane() {
  const { t } = useI18n();
  const lib = useLibrary();
  const [filter, setFilter] = useState<AssetFilter>(DEFAULT_FILTER);
  const visible = useMemo(() => applyFilter(lib.all, filter), [lib.all, filter]);
  // Frame numbers stay fixed per device, whatever the filter shows.
  const frameNumbers = useMemo(() => new Map(lib.all.map((a, i) => [a.id, i + 1])), [lib.all]);
  const selectedVisible = visible.filter((a) => lib.selectedSet.has(a.id)).length;

  const { select, setRating, selected, all } = lib;
  const onRateKey = useCallback(
    (rating: number | null, focusedId: string | null) => {
      const focused = all.find((a) => a.id === focusedId);
      // Rate the selection when the focused frame is part of it (or nothing
      // is focused); otherwise rate the focused frame alone.
      const targets = focused && !selected.some((a) => a.id === focused.id) ? [focused] : selected;
      setRating(rating, targets.length > 0 ? targets : focused ? [focused] : []);
    },
    [all, selected, setRating],
  );

  return (
    <div className="pane-body thumbnails-pane">
      <FilterBar
        filter={filter}
        onChange={setFilter}
        shown={visible.length}
        total={lib.all.length}
        selected={selectedVisible}
      />
      {lib.rate.isError && <p role="alert">{t.rateError(String(lib.rate.error))}</p>}
      {lib.assets.isPending && lib.deviceId !== undefined && <p className="hint">{t.loading}</p>}
      {lib.assets.isError && <p role="alert">{t.listError(String(lib.assets.error))}</p>}
      {lib.assets.data && (
        <AssetGrid
          assets={visible}
          selectedIds={lib.selectedSet}
          frameNumbers={frameNumbers}
          onSelectionChange={select}
          onRateKey={onRateKey}
          onRateAsset={(asset, rating) => setRating(rating, [asset])}
        />
      )}
      <p className="shortcut-hint">{t.shortcuts}</p>
    </div>
  );
}
