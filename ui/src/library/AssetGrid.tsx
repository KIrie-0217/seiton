import type { KeyboardEvent } from "react";
import { GridLayout, GridList, GridListItem, Size, Virtualizer, type Selection } from "react-aria-components";
import type { AssetView, MediaKind } from "../api";
import { MESSAGES, useI18n } from "../i18n";
import { useThumbnail } from "./queries";
import { StarBar } from "./StarRating";

/** File type names: interface labels, the same in every locale. */
export const KIND_LABEL: Record<MediaKind, string> = MESSAGES.en.kind as Record<MediaKind, string>;

const LAYOUT_OPTIONS = {
  minItemSize: new Size(184, 214),
  maxItemSize: new Size(260, 280),
  minSpace: new Size(6, 10),
  preserveAspectRatio: false,
};

function Thumbnail({ asset }: { asset: AssetView }) {
  const { t } = useI18n();
  const { data, isError } = useThumbnail(asset.id);
  if (isError) return <div className="thumb thumb-error">{t.thumbError}</div>;
  if (!data) return <div className="thumb thumb-loading" aria-hidden="true" />;
  return <img className="thumb" src={data} alt="" draggable={false} />;
}

export interface AssetGridProps {
  assets: AssetView[];
  selectedIds: ReadonlySet<string>;
  /** New selection, and the frame that has focus (if any). */
  onSelectionChange: (ids: string[], focusedId: string | null) => void;
  /** 0–5 pressed on the grid: rate the selection, or the focused frame. */
  onRateKey: (rating: number | null, focusedId: string | null) => void;
  /** Stars pressed on one frame (that asset only). */
  onRateAsset: (asset: AssetView, rating: number | null) => void;
  /** Frame number of each asset on the device (position in the full list). */
  frameNumbers: ReadonlyMap<string, number>;
}

/** The asset id of the row that currently holds focus. */
function focusedKey(): string | null {
  const el = document.activeElement?.closest<HTMLElement>("[role=row][data-key]");
  return el?.dataset.key ?? null;
}

/**
 * The contact sheet: a virtualized React Aria GridList laid out as a grid.
 * React Aria provides arrow / Home / End / PageUp / PageDown navigation,
 * selection (click, Ctrl/⌘-click, Shift-click, Space, Ctrl+A) and type-ahead;
 * seiton adds 0–5 for ratings.
 */
export function AssetGrid({ assets, selectedIds, onSelectionChange, onRateKey, onRateAsset, frameNumbers }: AssetGridProps) {
  const { t } = useI18n();

  function change(keys: Selection) {
    const ids = keys === "all" ? assets.map((a) => a.id) : [...keys].map(String);
    onSelectionChange(ids, focusedKey());
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!/^[0-5]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    const n = Number(e.key);
    onRateKey(n === 0 ? null : n, focusedKey());
  }

  return (
    // Capture digits before GridList's type-ahead sees them.
    <div className="asset-grid-wrap" onKeyDownCapture={onKeyDown}>
      <Virtualizer layout={GridLayout} layoutOptions={LAYOUT_OPTIONS}>
        <GridList
          className="asset-grid"
          aria-label={t.frames}
          layout="grid"
          items={assets}
          selectionMode="multiple"
          selectionBehavior="replace"
          selectedKeys={selectedIds as Set<string>}
          onSelectionChange={change}
          renderEmptyState={() => <p className="grid-empty">{t.noMatches}</p>}
        >
          {(asset) => {
            const frame = frameNumbers.get(asset.id) ?? 0;
            return (
              <GridListItem
                id={asset.id}
                className="asset-cell"
                textValue={`${asset.name}, ${t.frameNumber(frame)}`}
              >
                <div className="frame">
                  <Thumbnail asset={asset} />
                </div>
                <div className="frame-strip">
                  <span className="frame-number" aria-hidden="true">
                    {String(frame).padStart(3, "0")}
                  </span>
                  <span className="cell-name">{asset.name}</span>
                  <span className="cell-kinds">{asset.files.map((f) => KIND_LABEL[f.kind]).join(" · ")}</span>
                </div>
                <div className="frame-marks">
                  <StarBar name={asset.name} rating={asset.rating} onRate={(r) => onRateAsset(asset, r)} />
                  {asset.imported && <span className="imported-mark">{t.imported}</span>}
                </div>
              </GridListItem>
            );
          }}
        </GridList>
      </Virtualizer>
    </div>
  );
}
