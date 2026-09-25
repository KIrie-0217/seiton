import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AssetView, MediaKind } from "../api";
import { useThumbnail } from "./queries";
import { StarBar } from "./StarRating";

const MIN_CELL_WIDTH = 180;
const ROW_HEIGHT = 224;
/** Used before the container has been measured (and in tests without layout). */
const FALLBACK_WIDTH = 900;

export const KIND_LABEL: Record<MediaKind, string> = {
  raw: "RAW",
  heif: "HEIF",
  jpeg: "JPEG",
  video: "動画",
  sidecar: "XMP",
};

function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.offsetWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function Thumbnail({ asset }: { asset: AssetView }) {
  const { data, isError } = useThumbnail(asset.id);
  if (isError) return <div className="thumb thumb-error">読み込めません</div>;
  if (!data) return <div className="thumb thumb-loading" aria-hidden="true" />;
  return <img className="thumb" src={data} alt="" draggable={false} />;
}

export interface AssetGridProps {
  assets: AssetView[];
  /** Index (into `assets`) of the cell that has keyboard focus. */
  activeIndex: number;
  selectedIds: ReadonlySet<string>;
  onActivate: (index: number, mode: "replace" | "toggle" | "focus-only") => void;
  onToggleSelection: (index: number) => void;
  /** Rating shortcut (0 clears, 1–5 set) for the current selection. */
  onRate: (rating: number | null) => void;
  /** Rating set by clicking the stars of one cell (that asset only). */
  onRateAsset: (asset: AssetView, rating: number | null) => void;
  onOpen?: (index: number) => void;
}

/**
 * Virtualized thumbnail grid following the ARIA grid pattern: arrow keys
 * move focus (roving tabindex), Space toggles selection and 0–5 rate the
 * selection. Only visible rows are rendered, so large cards stay fast.
 */
export function AssetGrid({
  assets,
  activeIndex,
  selectedIds,
  onActivate,
  onToggleSelection,
  onRate,
  onRateAsset,
  onOpen,
}: AssetGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const measured = useElementWidth(scrollRef);
  const width = measured > 0 ? measured : FALLBACK_WIDTH;
  const columns = Math.max(1, Math.floor(width / MIN_CELL_WIDTH));
  const rowCount = Math.ceil(assets.length / columns);

  // TanStack Virtual is not React Compiler compatible; the component is
  // intentionally left unmemoized (see eslint react-hooks/incompatible-library).
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 2,
    initialRect: { width: FALLBACK_WIDTH, height: 3 * ROW_HEIGHT },
  });

  // Keyboard navigation scrolls the active cell into view, then focuses it
  // once its row has been rendered.
  const pendingFocus = useRef(false);
  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    if (!pendingFocus.current) return;
    const cell = scrollRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (cell) {
      cell.focus({ preventScroll: true });
      pendingFocus.current = false;
    }
  }, [activeIndex, virtualItems]);

  const moveTo = useCallback(
    (index: number, extend: boolean) => {
      if (assets.length === 0) return;
      const next = Math.min(assets.length - 1, Math.max(0, index));
      pendingFocus.current = true;
      virtualizer.scrollToIndex(Math.floor(next / columns), { align: "auto" });
      onActivate(next, extend ? "focus-only" : "replace");
    },
    [assets.length, columns, onActivate, virtualizer],
  );

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = activeIndex;
    const ctrl = e.ctrlKey || e.metaKey;
    const pageRows = Math.max(1, Math.floor((scrollRef.current?.clientHeight || 3 * ROW_HEIGHT) / ROW_HEIGHT));
    const rowStart = i - (i % columns);
    let target: number;
    switch (e.key) {
      case "ArrowRight":
        target = i + 1;
        break;
      case "ArrowLeft":
        target = i - 1;
        break;
      case "ArrowDown":
        target = i + columns < assets.length ? i + columns : i;
        break;
      case "ArrowUp":
        target = i - columns >= 0 ? i - columns : i;
        break;
      case "Home":
        target = ctrl ? 0 : rowStart;
        break;
      case "End":
        target = ctrl ? assets.length - 1 : Math.min(assets.length - 1, rowStart + columns - 1);
        break;
      case "PageDown":
        target = Math.min(assets.length - 1, i + pageRows * columns);
        break;
      case "PageUp":
        target = Math.max(0, i - pageRows * columns);
        break;
      case " ":
        e.preventDefault();
        onToggleSelection(i);
        return;
      case "Enter":
        e.preventDefault();
        onOpen?.(i);
        return;
      default:
        if (/^[0-5]$/.test(e.key) && !ctrl && !e.altKey) {
          e.preventDefault();
          const n = Number(e.key);
          onRate(n === 0 ? null : n);
        }
        return;
    }
    e.preventDefault();
    moveTo(target, ctrl);
  }

  function onCellClick(e: MouseEvent, index: number) {
    onActivate(index, e.ctrlKey || e.metaKey ? "toggle" : "replace");
  }

  if (assets.length === 0) {
    return <p className="grid-empty">条件に一致する写真・動画はありません。</p>;
  }

  return (
    <div
      ref={scrollRef}
      className="asset-grid"
      role="grid"
      aria-label="写真と動画"
      aria-multiselectable="true"
      aria-rowcount={rowCount}
      aria-colcount={columns}
      onKeyDown={onKeyDown}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualItems.map((row) => {
          const start = row.index * columns;
          const rowAssets = assets.slice(start, start + columns);
          return (
            <div
              key={row.key}
              role="row"
              aria-rowindex={row.index + 1}
              className="asset-row"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: row.size,
                transform: `translateY(${row.start}px)`,
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
              }}
            >
              {rowAssets.map((asset, col) => {
                const index = start + col;
                const selected = selectedIds.has(asset.id);
                return (
                  <div
                    key={asset.id}
                    role="gridcell"
                    aria-colindex={col + 1}
                    aria-selected={selected}
                    data-index={index}
                    tabIndex={index === activeIndex ? 0 : -1}
                    className={`asset-cell${selected ? " selected" : ""}`}
                    onClick={(e) => onCellClick(e, index)}
                    onDoubleClick={() => onOpen?.(index)}
                    onFocus={() => {
                      if (index !== activeIndex) onActivate(index, "focus-only");
                    }}
                  >
                    <Thumbnail asset={asset} />
                    <div className="cell-caption">
                      <span className="cell-name">{asset.name}</span>
                      <div className="cell-badges">
                        {asset.files.map((f) => (
                          <span key={f.path} className={`badge kind-${f.kind}`}>
                            {KIND_LABEL[f.kind]}
                          </span>
                        ))}
                        {asset.imported && <span className="badge imported">取込済</span>}
                      </div>
                    </div>
                    <StarBar name={asset.name} rating={asset.rating} onRate={(r) => onRateAsset(asset, r)} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
