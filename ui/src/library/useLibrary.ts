import { useCallback, useMemo } from "react";
import type { AssetView } from "../api";
import { useWorkspace } from "../windowing/Workspace";
import { useAssets, useDevices, useSetRating } from "./queries";

export type ActivateMode = "replace" | "toggle" | "focus-only";

/**
 * Library data plus the selection shared by every pane and window.
 * Selection is stored as asset ids so panes with different filters agree.
 */
export function useLibrary() {
  const { shared, updateShared } = useWorkspace();
  const devices = useDevices();
  const deviceId = shared.deviceId ?? devices.data?.[0]?.id;
  const device = devices.data?.find((d) => d.id === deviceId);
  const assets = useAssets(deviceId);
  const rate = useSetRating(deviceId);

  const all = useMemo(() => assets.data ?? [], [assets.data]);
  const selectedSet = useMemo(() => new Set(shared.selectedIds), [shared.selectedIds]);
  const selected = useMemo(() => all.filter((a) => selectedSet.has(a.id)), [all, selectedSet]);
  const active = useMemo(() => all.find((a) => a.id === shared.activeId), [all, shared.activeId]);

  const selectDevice = useCallback(
    (id: string) => updateShared({ deviceId: id, selectedIds: [], activeId: null }),
    [updateShared],
  );

  const activate = useCallback(
    (asset: AssetView, mode: ActivateMode) =>
      updateShared((prev) => {
        if (mode === "focus-only") return { activeId: asset.id };
        if (mode === "replace") return { activeId: asset.id, selectedIds: [asset.id] };
        const ids = prev.selectedIds.includes(asset.id)
          ? prev.selectedIds.filter((id) => id !== asset.id)
          : [...prev.selectedIds, asset.id];
        return { activeId: asset.id, selectedIds: ids };
      }),
    [updateShared],
  );

  /** What rating and details apply to: the selection, else the focused asset. */
  const targets = useMemo(() => (selected.length > 0 ? selected : active ? [active] : []), [active, selected]);

  const setRating = useCallback(
    (rating: number | null, assetsToRate: AssetView[] = targets) => {
      if (assetsToRate.length === 0) return;
      rate.mutate({ assetIds: assetsToRate.map((a) => a.id), rating });
    },
    [rate, targets],
  );

  return {
    devices,
    deviceId,
    device,
    assets,
    all,
    selectedSet,
    selected,
    active,
    targets,
    selectDevice,
    activate,
    setRating,
    rate,
  };
}
