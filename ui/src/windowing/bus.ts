import { emit, listen } from "@tauri-apps/api/event";
import type { AssetView } from "../api";

/** Which content a pane shows. */
export type PaneKind = "thumbnails" | "preview";

/** UI state shared by every window (the rest is per pane). */
export interface SharedState {
  deviceId: string | null;
  selectedIds: string[];
  /** The focused asset (keyboard focus / preview target). */
  activeId: string | null;
}

/**
 * Messages exchanged between windows. The backend (Rust, or the mock) also
 * publishes `assetsUpdated` after changing assets, with `from: "backend"`.
 */
export type BusMessage =
  | { type: "state"; from: string; state: SharedState }
  | { type: "stateRequest"; from: string }
  | { type: "assetsUpdated"; from: string; assets: AssetView[] }
  | { type: "dock"; from: string; pane: PaneKind };

export type BusListener = (msg: BusMessage) => void;

/**
 * Cross-window messaging. Delivers to other windows; messages a window
 * publishes itself are never delivered back to it.
 */
export interface Bus {
  publish(msg: BusMessage): void;
  subscribe(listener: BusListener): () => void;
}

/** Tauri event name used for the bus. Rust emits on the same channel. */
export const BUS_EVENT = "seiton://bus";

/** Tauri events: reach every webview of the app, including other windows. */
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

/** BroadcastChannel: reaches other tabs / pop-ups of the same origin (browser mock). */
export function createBroadcastBus(windowId: string, name = "seiton"): Bus {
  const channel = new BroadcastChannel(name);
  return {
    publish(msg) {
      channel.postMessage(msg);
    },
    subscribe(listener) {
      const onMessage = (e: MessageEvent<BusMessage>) => {
        if (e.data.from !== windowId) listener(e.data);
      };
      channel.addEventListener("message", onMessage);
      return () => channel.removeEventListener("message", onMessage);
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
