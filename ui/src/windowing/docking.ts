/** Screen rectangle of a window (any consistent unit, e.g. physical px). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How far outside the main window a drop still counts as "near". */
export const DOCK_MARGIN = 32;

/** No move for this long ends the drag (OS title-bar drags have no "drop" event). */
export const DOCK_SETTLE_MS = 500;

/**
 * Whether a pane window is being held over (or near) the main window.
 *
 * Uses the middle of the pane window's title bar, which is roughly where
 * the pointer is while dragging a window, so a window placed next to the
 * main window does not count.
 */
export function isOverMain(pane: Rect, main: Rect, margin = DOCK_MARGIN): boolean {
  const px = pane.x + pane.width / 2;
  const py = pane.y + 16;
  return (
    px >= main.x - margin &&
    px <= main.x + main.width + margin &&
    py >= main.y - margin &&
    py <= main.y + main.height + margin
  );
}

export interface DockTrackerOptions {
  onHover: (hovering: boolean) => void;
  onDock: () => void;
  settleMs?: number;
}

/**
 * Turns a stream of window positions into "hovering" and "dock" events.
 *
 * The tracker is disarmed until the window has been outside the main
 * window at least once, so a window that happens to open on top of the
 * main window is not docked immediately.
 */
export function createDockTracker({ onHover, onDock, settleMs = DOCK_SETTLE_MS }: DockTrackerOptions) {
  let armed = false;
  let hovering = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function setHovering(next: boolean) {
    if (hovering === next) return;
    hovering = next;
    onHover(next);
  }

  return {
    update(pane: Rect, main: Rect | null) {
      clearTimeout(timer);
      const over = main !== null && isOverMain(pane, main);
      if (!over) {
        armed = true;
        setHovering(false);
        return;
      }
      if (!armed) return;
      setHovering(true);
      timer = setTimeout(() => {
        if (hovering) onDock();
      }, settleMs);
    },
    dispose() {
      clearTimeout(timer);
    },
  };
}
