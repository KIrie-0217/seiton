import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

const MIN = 20;
const MAX = 80;
const STEP = 5;

function clamp(v: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(v)));
}

function loadRatio(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return localStorage.getItem(key) !== null && Number.isFinite(v) && v >= MIN && v <= MAX ? v : fallback;
  } catch {
    return fallback;
  }
}

interface SplitViewProps {
  first: ReactNode;
  second: ReactNode;
  /** `row`: side by side (vertical separator). `column`: stacked. */
  direction?: "row" | "column";
  /** Initial size of the first pane in percent. */
  defaultRatio?: number;
  label?: string;
  /** Where the ratio is remembered. */
  storageKey?: string;
}

/**
 * Two panes with a draggable, keyboard-operable separator (WAI-ARIA window
 * splitter: arrows ±5%, Home/End to the limits).
 */
export function SplitView({
  first,
  second,
  direction = "row",
  defaultRatio = 65,
  label = "Resize panes",
  storageKey = "seiton.split.ratio",
}: SplitViewProps) {
  const [ratio, setRatio] = useState(() => loadRatio(storageKey, defaultRatio));
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const row = direction === "row";

  function commit(next: number) {
    const v = clamp(next);
    setRatio(v);
    try {
      localStorage.setItem(storageKey, String(v));
    } catch {
      // Storage may be unavailable; the ratio just isn't remembered.
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    const map: Record<string, number> = row
      ? { ArrowLeft: ratio - STEP, ArrowRight: ratio + STEP, Home: MIN, End: MAX }
      : { ArrowUp: ratio - STEP, ArrowDown: ratio + STEP, Home: MIN, End: MAX };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    commit(next);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!dragging.current || !rect) return;
    const span = row ? rect.width : rect.height;
    if (span === 0) return;
    commit((((row ? e.clientX - rect.left : e.clientY - rect.top) / span) * 100));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    dragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  const tracks = `minmax(0, ${ratio}fr) 6px minmax(0, ${100 - ratio}fr)`;
  return (
    <div
      ref={containerRef}
      className={`split-view split-${direction}`}
      style={row ? { gridTemplateColumns: tracks } : { gridTemplateRows: tracks }}
    >
      <div className="split-pane">{first}</div>
      <div
        className="split-separator"
        role="separator"
        // The separator line is vertical when the panes are side by side.
        aria-orientation={row ? "vertical" : "horizontal"}
        aria-label={label}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={ratio}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="split-pane">{second}</div>
    </div>
  );
}
