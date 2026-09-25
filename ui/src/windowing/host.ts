import { isTauri } from "@tauri-apps/api/core";
import { currentMonitor, getCurrentWindow, Window } from "@tauri-apps/api/window";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { isPaneKind, type PaneKind } from "./bus";
import type { Rect } from "./docking";

/** A pane shown in its own window, as seen from the main window. */
export interface PaneWindow {
  readonly id: string;
  readonly kind: PaneKind;
  focus(): void;
  close(): void;
  /** Called once when the window goes away (closed by the user or docked). */
  onClosed(callback: () => void): void;
}

/** Creates and controls OS windows. */
export interface WindowHost {
  /** This window's id: `main`, or `pane-<kind>` for a pane window. */
  readonly windowId: string;
  /**
   * Shows `kind` in its own window. There is at most one window per kind:
   * if it is already open it is focused and returned.
   */
  openPane(kind: PaneKind): Promise<PaneWindow>;
  closeSelf(): void;
  /**
   * Reports this window's rectangle (and the main window's) whenever this
   * window moves. Used by pane windows to dock by dragging.
   */
  watchGeometry(callback: (self: Rect, main: Rect | null) => void): () => void;
}

export const MAIN_WINDOW_ID = "main";

/** The single window label for a pane kind (matches `pane-*` in capabilities). */
export function paneWindowId(kind: PaneKind): string {
  return `pane-${kind}`;
}

export const PANE_WINDOW_TITLES: Record<PaneKind, string> = {
  thumbnails: "Thumbnails",
  preview: "Preview",
  import: "Import Settings",
};

const PANE_SIZES: Record<PaneKind, { width: number; height: number }> = {
  thumbnails: { width: 1100, height: 720 },
  preview: { width: 900, height: 720 },
  import: { width: 520, height: 720 },
};

/** Where a window should start, from its URL (`?pane=preview`). */
export function paneFromLocation(search: string): PaneKind | null {
  const pane = new URLSearchParams(search).get("pane");
  return isPaneKind(pane) ? pane : null;
}

function tauriHandle(kind: PaneKind, win: WebviewWindow): PaneWindow {
  return {
    id: win.label,
    kind,
    focus: () => void win.setFocus(),
    close: () => void win.close(),
    onClosed: (cb) => void win.once("tauri://destroyed", () => cb()),
  };
}

/** Next to the current window (right side), kept on its monitor. Logical px. */
async function besideCurrent(width: number): Promise<{ x: number; y: number } | undefined> {
  try {
    const current = getCurrentWindow();
    const scale = await current.scaleFactor();
    const pos = (await current.outerPosition()).toLogical(scale);
    const size = (await current.outerSize()).toLogical(scale);
    let x = pos.x + size.width + 16;
    const monitor = await currentMonitor();
    if (monitor) {
      const mpos = monitor.position.toLogical(monitor.scaleFactor);
      const right = mpos.x + monitor.size.width / monitor.scaleFactor;
      if (x + width > right) x = Math.max(mpos.x, right - width);
    }
    return { x, y: pos.y };
  } catch {
    return undefined;
  }
}

async function tauriRect(win: Window): Promise<Rect> {
  const [pos, size] = await Promise.all([win.outerPosition(), win.outerSize()]);
  return { x: pos.x, y: pos.y, width: size.width, height: size.height };
}

/** Real windows via Tauri. Labels must match `capabilities/default.json`. */
export function createTauriHost(): WindowHost {
  const current = getCurrentWebviewWindow();
  return {
    windowId: current.label,
    async openPane(kind) {
      const id = paneWindowId(kind);
      const existing = await WebviewWindow.getByLabel(id);
      if (existing) {
        void existing.setFocus();
        return tauriHandle(kind, existing);
      }
      const size = PANE_SIZES[kind];
      const position = await besideCurrent(size.width);
      const win = new WebviewWindow(id, {
        url: `index.html?pane=${kind}`,
        title: `seiton — ${PANE_WINDOW_TITLES[kind]}`,
        ...size,
        ...position,
        minWidth: 420,
        minHeight: 360,
      });
      return new Promise<PaneWindow>((resolve, reject) => {
        void win.once("tauri://error", (e) => reject(new Error(String(e.payload))));
        void win.once("tauri://created", () => resolve(tauriHandle(kind, win)));
      });
    },
    closeSelf() {
      void current.close();
    },
    watchGeometry(callback) {
      const self = getCurrentWindow();
      let disposed = false;
      let unlisten: (() => void) | undefined;
      const report = async () => {
        const main = await Window.getByLabel(MAIN_WINDOW_ID);
        const [selfRect, mainRect] = await Promise.all([tauriRect(self), main ? tauriRect(main) : null]);
        if (!disposed) callback(selfRect, mainRect);
      };
      void self
        .onMoved(() => void report())
        .then((fn) => {
          if (disposed) fn();
          else unlisten = fn;
        });
      return () => {
        disposed = true;
        unlisten?.();
      };
    },
  };
}

function browserRect(w: globalThis.Window): Rect {
  return { x: w.screenX, y: w.screenY, width: w.outerWidth, height: w.outerHeight };
}

/** Pop-up windows in a plain browser (`npm run dev:mock`). */
export function createBrowserHost(windowId: string): WindowHost {
  const open = new Map<PaneKind, { win: globalThis.Window; handle: PaneWindow }>();
  return {
    windowId,
    async openPane(kind) {
      const current = open.get(kind);
      if (current && !current.win.closed) {
        current.win.focus();
        return current.handle;
      }
      const id = paneWindowId(kind);
      const { width, height } = PANE_SIZES[kind];
      const left = window.screenX + window.outerWidth + 16;
      const features = `popup,width=${width},height=${height},left=${left},top=${window.screenY}`;
      const win = window.open(`${location.pathname}?pane=${kind}`, id, features);
      if (!win) throw new Error("ポップアップがブロックされました。ブラウザでポップアップを許可してください。");
      const callbacks: (() => void)[] = [];
      const timer = setInterval(() => {
        if (win.closed) {
          clearInterval(timer);
          open.delete(kind);
          callbacks.splice(0).forEach((cb) => cb());
        }
      }, 300);
      const handle: PaneWindow = {
        id,
        kind,
        focus: () => win.focus(),
        close: () => win.close(),
        onClosed: (cb) => void callbacks.push(cb),
      };
      open.set(kind, { win, handle });
      return handle;
    },
    closeSelf() {
      window.close();
    },
    watchGeometry(callback) {
      // Browsers have no window-move event: poll the pop-up's position.
      let last = "";
      const timer = setInterval(() => {
        const self = browserRect(window);
        const key = `${self.x},${self.y},${self.width},${self.height}`;
        if (key === last) return;
        const first = last === "";
        last = key;
        if (first) return; // initial position is not a move
        const opener = window.opener as globalThis.Window | null;
        let main: Rect | null;
        try {
          main = opener && !opener.closed ? browserRect(opener) : null;
        } catch {
          main = null;
        }
        callback(self, main);
      }, 150);
      return () => clearInterval(timer);
    },
  };
}

/** Picks the host for the current runtime. */
export function createDefaultHost(): WindowHost {
  if (isTauri()) return createTauriHost();
  const pane = paneFromLocation(location.search);
  return createBrowserHost(pane ? paneWindowId(pane) : MAIN_WINDOW_ID);
}
