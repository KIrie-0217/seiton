import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

const MIN = 20;
const MAX = 80;
const STEP = 5;
const STORAGE_KEY = "seiton.split.ratio";

function clamp(v: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(v)));
}

function loadRatio(fallback: number): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) && v >= MIN && v <= MAX ? v : fallback;
  } catch {
    return fallback;
  }
}

interface SplitViewProps {
  first: ReactNode;
  second: ReactNode;
  /** Initial size of the first pane in percent. */
  defaultRatio?: number;
  label?: string;
}

/**
 * Two panes side by side with a draggable, keyboard-operable separator
 * (WAI-ARIA window splitter: arrows ±5%, Home/End to the limits).
 */
export function SplitView({ first, second, defaultRatio = 65, label = "パネルの境界" }: SplitViewProps) {
  const [ratio, setRatio] = useState(() => loadRatio(defaultRatio));
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function commit(next: number) {
    const v = clamp(next);
    setRatio(v);
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      // Storage may be unavailable; the ratio just isn't remembered.
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    const map: Record<string, number> = { ArrowLeft: ratio - STEP, ArrowRight: ratio + STEP, Home: MIN, End: MAX };
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
    if (!dragging.current || !rect || rect.width === 0) return;
    commit(((e.clientX - rect.left) / rect.width) * 100);
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    dragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  return (
    <div
      ref={containerRef}
      className="split-view"
      style={{ gridTemplateColumns: `minmax(0, ${ratio}fr) 6px minmax(0, ${100 - ratio}fr)` }}
    >
      <div className="split-pane">{first}</div>
      <div
        className="split-separator"
        role="separator"
        aria-orientation="vertical"
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
