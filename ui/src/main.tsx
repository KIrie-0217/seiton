import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { App, type LibraryConfig } from "./App";
import { createBroadcastBus, createTauriBus } from "./windowing/bus";
import { createDefaultHost, paneFromLocation } from "./windowing/host";
import "./styles.css";

/**
 * `npm run dev:mock` (browser) and `npm run tauri:mock` (real windows) serve
 * seiton's commands from memory. Tauri APIs such as windows stay real.
 */
const useMock = import.meta.env.VITE_USE_MOCK === "true";

let library: LibraryConfig | undefined;
if (useMock) {
  const host = createDefaultHost();
  const bus = isTauri() ? createTauriBus(host.windowId) : createBroadcastBus(host.windowId);
  const { installMockBackend } = await import("./mock/backend");
  installMockBackend({ publish: (msg) => bus.publish(msg) });
  library = { host, bus, pane: paneFromLocation(location.search) };
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element not found");
}

createRoot(root).render(
  <StrictMode>
    <App library={library} />
  </StrictMode>,
);
