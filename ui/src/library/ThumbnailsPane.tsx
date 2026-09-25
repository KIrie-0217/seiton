import { useCallback, useMemo, useState } from "react";
import { AssetGrid } from "./AssetGrid";
import { FilterBar } from "./FilterBar";
import { applyFilter, DEFAULT_FILTER, type AssetFilter } from "./filter";
import { useLibrary } from "./useLibrary";

/** Filter bar + thumbnail grid. The filter is local to each pane. */
export function ThumbnailsPane() {
  const lib = useLibrary();
  const [filter, setFilter] = useState<AssetFilter>(DEFAULT_FILTER);
  const visible = useMemo(() => applyFilter(lib.all, filter), [lib.all, filter]);
  const found = visible.findIndex((a) => a.id === lib.active?.id);
  const activeIndex = found >= 0 ? found : 0;
  const selectedVisible = visible.filter((a) => lib.selectedSet.has(a.id)).length;

  const { activate, setRating } = lib;
  const onActivate = useCallback(
    (index: number, mode: "replace" | "toggle" | "focus-only") => {
      const asset = visible[index];
      if (asset) activate(asset, mode);
    },
    [activate, visible],
  );
  const onToggleSelection = useCallback((index: number) => onActivate(index, "toggle"), [onActivate]);
  const onRate = useCallback(
    (rating: number | null) => {
      // Without a selection, rate the focused cell of this pane.
      const focused = visible[activeIndex];
      setRating(rating, lib.selected.length > 0 ? lib.selected : focused ? [focused] : []);
    },
    [activeIndex, lib.selected, setRating, visible],
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
      {lib.rate.isError && <p role="alert">評価を保存できません: {String(lib.rate.error)}</p>}
      {lib.assets.isPending && lib.deviceId !== undefined && <p>読み込み中…</p>}
      {lib.assets.isError && <p role="alert">一覧を取得できません: {String(lib.assets.error)}</p>}
      {lib.assets.data && (
        <AssetGrid
          assets={visible}
          activeIndex={activeIndex}
          selectedIds={lib.selectedSet}
          onActivate={onActivate}
          onToggleSelection={onToggleSelection}
          onRate={onRate}
        />
      )}
      <p className="shortcut-hint">
        矢印キーで移動、Space で複数選択、0〜5 で評価（0 は解除）、Ctrl/⌘+クリックで追加選択
      </p>
    </div>
  );
}
