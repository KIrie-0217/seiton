import { act, render, type RenderResult } from "@testing-library/react";
import { App, createQueryClient } from "../App";
import { installMockBackend } from "../mock/backend";
import type { MockData } from "../mock/data";
import { createMemoryHub, type PaneKind } from "../windowing/bus";
import { MAIN_WINDOW_ID, type PaneWindow, type WindowHost } from "../windowing/host";

export interface TestWindow {
  id: string;
  pane: PaneKind | null;
  view: RenderResult;
  close(): void;
  closed: boolean;
}

/**
 * Simulates several app windows in one document: each window gets its own
 * React tree, query cache and bus connection; the mock backend is shared,
 * like the Rust backend is shared by real windows.
 */
export function createTestDesktop(options: { prepare?: (data: MockData) => void } = {}) {
  const hub = createMemoryHub();
  const data: MockData = installMockBackend({
    listDelayMs: 0,
    thumbDelayMs: [0, 0],
    publish: hub.backend.publish,
    storage: null,
  });
  options.prepare?.(data);
  const windows: TestWindow[] = [];
  let counter = 0;

  function mount(id: string, pane: PaneKind | null): TestWindow {
    const callbacks: (() => void)[] = [];
    const win: TestWindow = {
      id,
      pane,
      closed: false,
      view: undefined as unknown as RenderResult,
      close() {
        if (win.closed) return;
        win.closed = true;
        act(() => win.view.unmount());
        callbacks.forEach((cb) => cb());
      },
    };
    const host: WindowHost = {
      windowId: id,
      async openPane(kind) {
        counter += 1;
        const child = mount(`pane-test-${counter}`, kind);
        return {
          id: child.id,
          focus: () => {},
          close: () => child.close(),
          onClosed: (cb) => childCallbacks.get(child.id)?.push(cb),
        } satisfies PaneWindow;
      },
      closeSelf: () => queueMicrotask(() => win.close()),
    };
    childCallbacks.set(id, callbacks);
    const container = document.body.appendChild(document.createElement("div"));
    container.dataset.window = id;
    win.view = render(<App library={{ host, bus: hub.connect(id), pane }} queryClient={createQueryClient()} />, {
      container,
    });
    windows.push(win);
    return win;
  }

  const childCallbacks = new Map<string, (() => void)[]>();
  const main = mount(MAIN_WINDOW_ID, null);
  return { hub, data, main, windows, openWindows: () => windows.filter((w) => !w.closed) };
}
