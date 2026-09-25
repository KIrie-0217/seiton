import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CloseIcon, DockIcon, FocusIcon, IconButton, ImportIcon, PopOutIcon, ShowIcon } from "../icons";
import { ImportDialog } from "../importing/ImportDialog";
import { ImportProgressBar } from "../importing/ImportProgressBar";
import { ImportSettingsPane } from "../importing/ImportSettingsPane";
import { useImportStatus } from "../importing/queries";
import { PANE_KINDS, type PaneKind } from "../windowing/bus";
import { createDockTracker } from "../windowing/docking";
import { PANE_WINDOW_TITLES, type PaneWindow } from "../windowing/host";
import { SplitView } from "../windowing/SplitView";
import { useWorkspace } from "../windowing/Workspace";
import { DeviceList } from "./DeviceList";
import { PreviewPane } from "./PreviewPane";
import { ThumbnailsPane } from "./ThumbnailsPane";
import { useLibrary } from "./useLibrary";

export const PANE_TITLE = PANE_WINDOW_TITLES;

/** Panes stacked in the right column of the main window, top to bottom. */
const RIGHT_COLUMN: PaneKind[] = ["preview", "import"];

export function PaneContent({ kind }: { kind: PaneKind }) {
  switch (kind) {
    case "thumbnails":
      return <ThumbnailsPane />;
    case "preview":
      return <PreviewPane />;
    case "import":
      return <ImportSettingsPane />;
  }
}

interface PaneFrameProps {
  kind: PaneKind;
  actions: ReactNode;
}

/** A titled region with icon actions. */
export function PaneFrame({ kind, actions }: PaneFrameProps) {
  const headingId = `pane-${kind}-heading`;
  return (
    <section className="pane" aria-labelledby={headingId}>
      <header className="pane-header">
        <h2 id={headingId}>{PANE_TITLE[kind]}</h2>
        <div className="pane-actions">{actions}</div>
      </header>
      <PaneContent kind={kind} />
    </section>
  );
}

/**
 * Main window: devices, the panes (Thumbnails on the left; Preview and
 * Import Settings stacked on the right) and a status bar with import
 * progress and the import button.
 *
 * Each pane exists once: docked here, in its own window, or hidden. A pane
 * window comes back when it is closed, with its dock button, or when the
 * window itself is dragged over this window and released.
 */
export function Library() {
  const { host, bus } = useWorkspace();
  const lib = useLibrary();
  const status = useImportStatus().data;
  const [docked, setDocked] = useState<PaneKind[]>([...PANE_KINDS]);
  const [externals, setExternals] = useState<Partial<Record<PaneKind, PaneWindow>>>({});
  const [hovering, setHovering] = useState<PaneKind | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const externalsRef = useRef(externals);
  useEffect(() => {
    externalsRef.current = externals;
  }, [externals]);

  const dock = useCallback((kind: PaneKind) => {
    setDocked((prev) => (prev.includes(kind) ? prev : PANE_KINDS.filter((k) => k === kind || prev.includes(k))));
    setHovering((cur) => (cur === kind ? null : cur));
  }, []);

  /** Docks `kind` and closes its window if it has one. */
  const dockAndClose = useCallback(
    (kind: PaneKind) => {
      dock(kind);
      externalsRef.current[kind]?.close();
    },
    [dock],
  );

  async function popOut(kind: PaneKind) {
    setError(null);
    try {
      const win = await host.openPane(kind);
      if (externalsRef.current[kind]?.id !== win.id) {
        win.onClosed(() => {
          setExternals((prev) => {
            const next = { ...prev };
            delete next[kind];
            return next;
          });
          // A pane never disappears by closing its window: it comes back here.
          dock(kind);
        });
      }
      setExternals((prev) => ({ ...prev, [kind]: win }));
      setDocked((prev) => prev.filter((k) => k !== kind));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(
    () =>
      bus.subscribe((msg) => {
        if (msg.type === "dock") dock(msg.pane);
        if (msg.type === "dockHover") setHovering((cur) => (msg.hovering ? msg.pane : cur === msg.pane ? null : cur));
      }),
    [bus, dock],
  );

  // Pane windows do not outlive the main window (Rust does the same in Tauri).
  useEffect(() => {
    const closeAll = () => Object.values(externalsRef.current).forEach((w) => w?.close());
    window.addEventListener("pagehide", closeAll);
    return () => window.removeEventListener("pagehide", closeAll);
  }, []);

  function paneActions(kind: PaneKind) {
    const last = docked.length === 1;
    return (
      <>
        <IconButton
          label={`${PANE_TITLE[kind]} を別ウィンドウで開く`}
          title={last ? "最後のパネルは別ウィンドウにできません" : undefined}
          icon={<PopOutIcon />}
          onClick={() => void popOut(kind)}
          disabled={last}
        />
        {!last && (
          <IconButton
            label={`${PANE_TITLE[kind]} を閉じる`}
            icon={<CloseIcon />}
            onClick={() => setDocked((prev) => prev.filter((k) => k !== kind))}
          />
        )}
      </>
    );
  }

  const frame = (kind: PaneKind) => <PaneFrame kind={kind} actions={paneActions(kind)} />;
  const left = docked.includes("thumbnails") ? frame("thumbnails") : null;
  const rightKinds = RIGHT_COLUMN.filter((k) => docked.includes(k));
  const right =
    rightKinds.length === 2 ? (
      <SplitView
        direction="column"
        storageKey="seiton.split.right"
        defaultRatio={55}
        label="Preview と Import Settings の境界"
        first={frame(rightKinds[0]!)}
        second={frame(rightKinds[1]!)}
      />
    ) : rightKinds[0] ? (
      frame(rightKinds[0])
    ) : null;

  const running = status?.state === "running";

  return (
    <div className="library">
      <aside className="sidebar">
        <h2>Devices</h2>
        {lib.devices.isPending && <p>検出中…</p>}
        {lib.devices.isError && <p role="alert">デバイスを取得できません: {String(lib.devices.error)}</p>}
        {lib.devices.data && (
          <DeviceList devices={lib.devices.data} selectedId={lib.deviceId} onSelect={lib.selectDevice} />
        )}

        <h2>Windows</h2>
        <ul className="window-list" aria-label="Windows">
          {PANE_KINDS.map((kind) => {
            const ext = externals[kind];
            const isDocked = docked.includes(kind);
            const state = ext ? "別ウィンドウ" : isDocked ? "メインウィンドウ" : "非表示";
            return (
              <li key={kind}>
                <span className="window-name">{PANE_TITLE[kind]}</span>
                <span className="window-status">{state}</span>
                {ext && (
                  <>
                    <IconButton label={`${PANE_TITLE[kind]} を前面に表示`} icon={<FocusIcon />} onClick={() => ext.focus()} />
                    <IconButton
                      label={`${PANE_TITLE[kind]} をメインウィンドウに戻す`}
                      icon={<DockIcon />}
                      onClick={() => dockAndClose(kind)}
                    />
                  </>
                )}
                {!ext && !isDocked && (
                  <IconButton label={`${PANE_TITLE[kind]} を表示`} icon={<ShowIcon />} onClick={() => dock(kind)} />
                )}
              </li>
            );
          })}
        </ul>
        {error && <p role="alert">{error}</p>}
      </aside>

      <div className="workspace">
        {left && right ? (
          <SplitView storageKey="seiton.split.main" label="Thumbnails と右パネルの境界" first={left} second={right} />
        ) : (
          (left ?? right)
        )}
      </div>

      <footer className="status-bar">
        <ImportProgressBar />
        <button
          type="button"
          className="primary import-button"
          onClick={() => setImportOpen(true)}
          disabled={running || !lib.deviceId}
          title={running ? "取り込みを実行中です" : undefined}
        >
          <ImportIcon />
          取り込み
        </button>
      </footer>

      {hovering && externals[hovering] && (
        <div className="dock-overlay" role="status">
          <p>離すと {PANE_TITLE[hovering]} をメインウィンドウに戻します</p>
        </div>
      )}

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
    </div>
  );
}

/**
 * Root of a pane window: one pane. It goes back to the main window with the
 * dock button, when closed, or when this window is dragged over the main
 * window and released.
 */
export function PaneWindowLayout({ kind }: { kind: PaneKind }) {
  const { host, bus } = useWorkspace();
  const lib = useLibrary();
  const [hovering, setHovering] = useState(false);

  const dockBack = useCallback(() => {
    bus.publish({ type: "dock", from: host.windowId, pane: kind });
    host.closeSelf();
  }, [bus, host, kind]);

  useEffect(() => {
    const tracker = createDockTracker({
      onHover: (h) => {
        setHovering(h);
        bus.publish({ type: "dockHover", from: host.windowId, pane: kind, hovering: h });
      },
      onDock: dockBack,
    });
    const stop = host.watchGeometry((self, main) => tracker.update(self, main));
    return () => {
      stop();
      tracker.dispose();
    };
  }, [bus, dockBack, host, kind]);

  return (
    <div className={`pane-window${hovering ? " docking" : ""}`}>
      <p className="pane-window-device">
        {lib.device ? lib.device.label : "デバイス未選択"}
        <span className="hint"> · ウィンドウをメインウィンドウの上へドラッグすると戻せます</span>
      </p>
      <PaneFrame
        kind={kind}
        actions={
          <IconButton label={`${PANE_TITLE[kind]} をメインウィンドウに戻す`} icon={<DockIcon />} onClick={dockBack} />
        }
      />
    </div>
  );
}
