import { useCallback, useMemo, useState } from "react";
import { AssetGrid } from "./AssetGrid";
import { DetailPanel } from "./DetailPanel";
import { DeviceList } from "./DeviceList";
import { FilterBar } from "./FilterBar";
import { applyFilter, DEFAULT_FILTER, type AssetFilter } from "./filter";
import { useAssets, useDevices, useSetRating } from "./queries";

interface Selection {
  /** Index into the filtered list of the focused cell. */
  active: number;
  ids: ReadonlySet<string>;
}

const EMPTY: Selection = { active: 0, ids: new Set() };

/** Device list, filter bar, thumbnail grid and detail panel. */
export function Library() {
  const devices = useDevices();
  const [pickedDevice, setPickedDevice] = useState<string>();
  const deviceId = pickedDevice ?? devices.data?.[0]?.id;
  const assets = useAssets(deviceId);
  const rate = useSetRating(deviceId);

  const [filter, setFilter] = useState<AssetFilter>(DEFAULT_FILTER);
  const [selection, setSelection] = useState<Selection>(EMPTY);

  const all = useMemo(() => assets.data ?? [], [assets.data]);
  const visible = useMemo(() => applyFilter(all, filter), [all, filter]);
  const active = Math.min(selection.active, Math.max(0, visible.length - 1));
  // Only assets that are still visible count as selected.
  const selected = useMemo(() => visible.filter((a) => selection.ids.has(a.id)), [visible, selection.ids]);
  const selectedIds = useMemo(() => new Set(selected.map((a) => a.id)), [selected]);

  const onActivate = useCallback(
    (index: number, mode: "replace" | "toggle" | "focus-only") => {
      const asset = visible[index];
      if (!asset) return;
      setSelection((prev) => {
        if (mode === "focus-only") return { ...prev, active: index };
        if (mode === "replace") return { active: index, ids: new Set([asset.id]) };
        const ids = new Set(prev.ids);
        if (ids.has(asset.id)) ids.delete(asset.id);
        else ids.add(asset.id);
        return { active: index, ids };
      });
    },
    [visible],
  );

  const onToggleSelection = useCallback((index: number) => onActivate(index, "toggle"), [onActivate]);

  const onRate = useCallback(
    (rating: number | null) => {
      // Rate the selection, or the focused cell when nothing is selected.
      const targets = selected.length > 0 ? selected : visible[active] ? [visible[active]] : [];
      if (targets.length === 0) return;
      rate.mutate({ assetIds: targets.map((a) => a.id), rating });
    },
    [active, rate, selected, visible],
  );

  function selectDevice(id: string) {
    setPickedDevice(id);
    setSelection(EMPTY);
  }

  function changeFilter(next: AssetFilter) {
    setFilter(next);
    setSelection((prev) => ({ ...prev, active: 0 }));
  }

  return (
    <div className="library">
      <aside className="sidebar">
        <h2>デバイス</h2>
        {devices.isPending && <p>検出中…</p>}
        {devices.isError && <p role="alert">デバイスを取得できません: {String(devices.error)}</p>}
        {devices.data && <DeviceList devices={devices.data} selectedId={deviceId} onSelect={selectDevice} />}
      </aside>

      <section className="browser" aria-label="写真と動画の一覧">
        <FilterBar
          filter={filter}
          onChange={changeFilter}
          shown={visible.length}
          total={all.length}
          selected={selected.length}
        />
        {rate.isError && <p role="alert">評価を保存できません: {String(rate.error)}</p>}
        {assets.isPending && deviceId !== undefined && <p>読み込み中…</p>}
        {assets.isError && <p role="alert">一覧を取得できません: {String(assets.error)}</p>}
        {assets.data && (
          <AssetGrid
            assets={visible}
            activeIndex={active}
            selectedIds={selectedIds}
            onActivate={onActivate}
            onToggleSelection={onToggleSelection}
            onRate={onRate}
          />
        )}
        <p className="shortcut-hint">
          矢印キーで移動、Space で複数選択、0〜5 で評価（0 は解除）、Ctrl/⌘+クリックで追加選択
        </p>
      </section>

      <DetailPanel
        selected={selected.length > 0 ? selected : visible[active] ? [visible[active]] : []}
        onRate={onRate}
        saving={rate.isPending}
      />
    </div>
  );
}
