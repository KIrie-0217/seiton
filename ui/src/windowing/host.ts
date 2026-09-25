import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { PaneKind } from "./bus";

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
}

export const MAIN_WINDOW_ID = "main";

/** The single window label for a pane kind (matches `pane-*` in capabilities). */
export function paneWindowId(kind: PaneKind): string {
  return `pane-${kind}`;
}

const TITLES: Record<PaneKind, string> = { thumbnails: "Thumbnails", preview: "Preview" };

/** Where a window should start, from its URL (`?pane=preview`). */
export function paneFromLocation(search: string): PaneKind | null {
  const pane = new URLSearchParams(search).get("pane");
  return pane === "thumbnails" || pane === "preview" ? pane : null;
}

function paneUrl(kind: PaneKind): string {
  return `index.html?pane=${kind}`;
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
      const win = new WebviewWindow(id, {
        url: paneUrl(kind),
        title: `seiton — ${TITLES[kind]}`,
        width: kind === "preview" ? 960 : 1100,
        height: 720,
        minWidth: 480,
        minHeight: 360,
        // Let HTML drag and drop work (needed to dock a pane by dropping it).
        dragDropEnabled: false,
      });
      return new Promise<PaneWindow>((resolve, reject) => {
        void win.once("tauri://error", (e) => reject(new Error(String(e.payload))));
        void win.once("tauri://created", () => resolve(tauriHandle(kind, win)));
      });
    },
    closeSelf() {
      void current.close();
    },
  };
}

/** Pop-up windows in a plain browser (`npm run dev:mock`). */
export function createBrowserHost(windowId: string): WindowHost {
  const open = new Map<PaneKind, { win: Window; handle: PaneWindow }>();
  return {
    windowId,
    async openPane(kind) {
      const current = open.get(kind);
      if (current && !current.win.closed) {
        current.win.focus();
        return current.handle;
      }
      const id = paneWindowId(kind);
      const win = window.open(`${location.pathname}?pane=${kind}`, id, "popup,width=1000,height=720");
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
  };
}

/** Picks the host for the current runtime. */
export function createDefaultHost(): WindowHost {
  if (isTauri()) return createTauriHost();
  const pane = paneFromLocation(location.search);
  return createBrowserHost(pane ? paneWindowId(pane) : MAIN_WINDOW_ID);
}
