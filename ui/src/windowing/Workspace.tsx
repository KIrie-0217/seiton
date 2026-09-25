import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AssetView } from "../api";
import { queryKeys } from "../library/queries";
import type { Bus, SharedState } from "./bus";
import { MAIN_WINDOW_ID, type WindowHost } from "./host";

interface Workspace {
  host: WindowHost;
  bus: Bus;
  isMain: boolean;
  shared: SharedState;
  /** Updates the shared state here and in every other window. */
  updateShared: (update: Partial<SharedState> | ((prev: SharedState) => Partial<SharedState>)) => void;
}

const WorkspaceContext = createContext<Workspace | null>(null);

export const INITIAL_SHARED: SharedState = { deviceId: null, selectedIds: [], activeId: null };

/** Merges updated assets into every cached asset list. */
function applyAssets(client: ReturnType<typeof useQueryClient>, assets: AssetView[]) {
  const byDevice = new Map<string, Map<string, AssetView>>();
  for (const a of assets) {
    const m = byDevice.get(a.deviceId) ?? new Map();
    m.set(a.id, a);
    byDevice.set(a.deviceId, m);
  }
  for (const [deviceId, byId] of byDevice) {
    client.setQueryData<AssetView[]>(queryKeys.assets(deviceId), (old) => old?.map((a) => byId.get(a.id) ?? a));
  }
}

interface WorkspaceProviderProps {
  host: WindowHost;
  bus: Bus;
  children: ReactNode;
}

/**
 * Keeps the shared UI state (device, selection, focus) and asset updates in
 * sync across windows. The main window answers state requests from newly
 * opened windows; after that every window broadcasts its changes.
 */
export function WorkspaceProvider({ host, bus, children }: WorkspaceProviderProps) {
  const client = useQueryClient();
  const isMain = host.windowId === MAIN_WINDOW_ID;
  const [shared, setShared] = useState<SharedState>(INITIAL_SHARED);
  // Latest state for bus handlers and functional updates (kept in sync by
  // every writer below, never during render).
  const sharedRef = useRef(shared);

  useEffect(() => {
    const unsubscribe = bus.subscribe((msg) => {
      switch (msg.type) {
        case "state":
          sharedRef.current = msg.state;
          setShared(msg.state);
          break;
        case "stateRequest":
          if (isMain) bus.publish({ type: "state", from: host.windowId, state: sharedRef.current });
          break;
        case "assetsUpdated":
          applyAssets(client, msg.assets);
          break;
        case "dock":
          break; // handled by the main layout
      }
    });
    if (!isMain) bus.publish({ type: "stateRequest", from: host.windowId });
    return unsubscribe;
  }, [bus, client, host.windowId, isMain]);

  const updateShared = useCallback<Workspace["updateShared"]>(
    (update) => {
      const prev = sharedRef.current;
      const next = { ...prev, ...(typeof update === "function" ? update(prev) : update) };
      sharedRef.current = next;
      setShared(next);
      bus.publish({ type: "state", from: host.windowId, state: next });
    },
    [bus, host.windowId],
  );

  const value = useMemo(() => ({ host, bus, isMain, shared, updateShared }), [host, bus, isMain, shared, updateShared]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const ws = useContext(WorkspaceContext);
  if (!ws) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ws;
}
