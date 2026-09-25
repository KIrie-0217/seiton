import { useCallback, useMemo } from "react";
import type { AssetView } from "../api";
import { useWorkspace } from "../windowing/Workspace";
import { useAssets, useDevices, useSetRating } from "./queries";

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
  // Without a focused frame, Preview shows the first one instead of blank paper.
  const active = useMemo(() => all.find((a) => a.id === shared.activeId) ?? all[0], [all, shared.activeId]);

  const selectDevice = useCallback(
    (id: string) => updateShared({ deviceId: id, selectedIds: [], activeId: null }),
    [updateShared],
  );

  /**
   * Sets the selection. The focused frame (or, without one, the last
   * selected frame) becomes the active frame shown in Preview.
   */
  const select = useCallback(
    (ids: string[], focusedId: string | null) =>
      updateShared((prev) => ({
        selectedIds: ids,
        activeId: focusedId ?? ids[ids.length - 1] ?? prev.activeId,
      })),
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
    select,
    setRating,
    rate,
  };
}
