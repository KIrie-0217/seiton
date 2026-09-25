import { emit, listen } from "@tauri-apps/api/event";
import type { AssetView, ImportProgress, ImportSettings } from "../api";

/** Which content a pane shows. Each kind exists once in the app. */
export type PaneKind = "thumbnails" | "preview" | "import";

export const PANE_KINDS: readonly PaneKind[] = ["thumbnails", "preview", "import"];

export function isPaneKind(v: unknown): v is PaneKind {
  return typeof v === "string" && (PANE_KINDS as readonly string[]).includes(v);
}

/** UI state shared by every window (the rest is per pane). */
export interface SharedState {
  deviceId: string | null;
  selectedIds: string[];
  /** The focused asset (keyboard focus / preview target). */
  activeId: string | null;
}

/**
 * Messages exchanged between windows. The backend (Rust, or the mock)
 * publishes `assetsUpdated`, `importSettingsUpdated` and `importProgress`
 * with `from: "backend"`.
 */
export type BusMessage =
  | { type: "state"; from: string; state: SharedState }
  | { type: "stateRequest"; from: string }
  | { type: "assetsUpdated"; from: string; assets: AssetView[] }
  | { type: "importSettingsUpdated"; from: string; settings: ImportSettings }
  | { type: "importProgress"; from: string; progress: ImportProgress }
  /** A pane window asks to go back into the main window. */
  | { type: "dock"; from: string; pane: PaneKind }
  /** A pane window is (no longer) being moved over the main window. */
  | { type: "dockHover"; from: string; pane: PaneKind; hovering: boolean };

export type BusListener = (msg: BusMessage) => void;

/**
 * Cross-window messaging. A message reaches every window except the one
 * named in `from` (so backend messages reach all windows).
 */
export interface Bus {
  publish(msg: BusMessage): void;
  subscribe(listener: BusListener): () => void;
}

/** Tauri event name used for the bus. Rust emits on the same channel. */
export const BUS_EVENT = "seiton://bus";

/** Tauri events reach every webview, including the sender's. */
export function createTauriBus(windowId: string): Bus {
  return {
    publish(msg) {
      void emit(BUS_EVENT, msg);
    },
    subscribe(listener) {
      let unlisten: (() => void) | null = null;
      let closed = false;
      void listen<BusMessage>(BUS_EVENT, (e) => {
        if (e.payload.from !== windowId) listener(e.payload);
      }).then((fn) => {
        if (closed) fn();
        else unlisten = fn;
      });
      return () => {
        closed = true;
        unlisten?.();
      };
    },
  };
}

/** BroadcastChannel (browser mock). Also delivers locally, like Tauri events. */
export function createBroadcastBus(windowId: string, name = "seiton"): Bus {
  const channel = new BroadcastChannel(name);
  const local = new Set<BusListener>();
  return {
    publish(msg) {
      channel.postMessage(msg);
      // BroadcastChannel skips the sending object; the local mock backend
      // publishes through this window, so deliver its messages here too.
      if (msg.from !== windowId) local.forEach((l) => l(msg));
    },
    subscribe(listener) {
      const onMessage = (e: MessageEvent<BusMessage>) => {
        if (e.data.from !== windowId) listener(e.data);
      };
      local.add(listener);
      channel.addEventListener("message", onMessage);
      return () => {
        local.delete(listener);
        channel.removeEventListener("message", onMessage);
      };
    },
  };
}

/** In-process hub for tests: every `connect` behaves like a window. */
export function createMemoryHub() {
  const listeners = new Map<string, Set<BusListener>>();
  function deliver(msg: BusMessage) {
    for (const [id, set] of listeners) {
      if (id === msg.from) continue;
      for (const l of set) l(msg);
    }
  }
  return {
    connect(windowId: string): Bus {
      return {
        publish: (msg) => queueMicrotask(() => deliver(msg)),
        subscribe(listener) {
          const set = listeners.get(windowId) ?? new Set();
          set.add(listener);
          listeners.set(windowId, set);
          return () => set.delete(listener);
        },
      };
    },
    /** Publishes as the backend (delivered to every window). */
    backend: { publish: (msg: BusMessage) => queueMicrotask(() => deliver(msg)) },
  };
}
