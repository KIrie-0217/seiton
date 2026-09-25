import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { PaneKind } from "./bus";

/** A pane shown in its own window, as seen from the window that opened it. */
export interface PaneWindow {
  readonly id: string;
  focus(): void;
  close(): void;
  /** Called once when the window goes away (closed by the user or docked). */
  onClosed(callback: () => void): void;
}

/** Creates and controls OS windows. */
export interface WindowHost {
  /** This window's id (`main` for the main window, `pane-*` otherwise). */
  readonly windowId: string;
  openPane(kind: PaneKind): Promise<PaneWindow>;
  closeSelf(): void;
}

export const MAIN_WINDOW_ID = "main";

const TITLES: Record<PaneKind, string> = { thumbnails: "一覧", preview: "プレビュー" };

/** Where a window should start, from its URL (`?pane=preview`). */
export function paneFromLocation(search: string): PaneKind | null {
  const pane = new URLSearchParams(search).get("pane");
  return pane === "thumbnails" || pane === "preview" ? pane : null;
}

function paneUrl(kind: PaneKind): string {
  return `index.html?pane=${kind}`;
}

let counter = 0;
function newPaneId(): string {
  counter += 1;
  return `pane-${Date.now().toString(36)}-${counter}`;
}

/** Real windows via Tauri. Labels must match `capabilities/default.json`. */
export function createTauriHost(): WindowHost {
  const current = getCurrentWebviewWindow();
  return {
    windowId: current.label,
    openPane(kind) {
      const id = newPaneId();
      const win = new WebviewWindow(id, {
        url: paneUrl(kind),
        title: `seiton — ${TITLES[kind]}`,
        width: kind === "preview" ? 960 : 1100,
        height: 720,
        minWidth: 480,
        minHeight: 360,
      });
      return new Promise<PaneWindow>((resolve, reject) => {
        void win.once("tauri://error", (e) => reject(new Error(String(e.payload))));
        void win.once("tauri://created", () =>
          resolve({
            id,
            focus: () => void win.setFocus(),
            close: () => void win.close(),
            onClosed: (cb) => void win.once("tauri://destroyed", () => cb()),
          }),
        );
      });
    },
    closeSelf() {
      void current.close();
    },
  };
}

/** Pop-up windows in a plain browser (`npm run dev:mock`). */
export function createBrowserHost(windowId: string): WindowHost {
  return {
    windowId,
    async openPane(kind) {
      const id = newPaneId();
      const url = `${location.pathname}?pane=${kind}#${id}`;
      const win = window.open(url, id, "popup,width=1000,height=720");
      if (!win) throw new Error("ポップアップがブロックされました。ブラウザでポップアップを許可してください。");
      let closedCallback: (() => void) | null = null;
      const timer = setInterval(() => {
        if (win.closed) {
          clearInterval(timer);
          closedCallback?.();
          closedCallback = null;
        }
      }, 400);
      return {
        id,
        focus: () => win.focus(),
        close: () => win.close(),
        onClosed: (cb) => {
          closedCallback = cb;
        },
      };
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
  const id = pane ? location.hash.slice(1) || newPaneId() : MAIN_WINDOW_ID;
  return createBrowserHost(id);
}
