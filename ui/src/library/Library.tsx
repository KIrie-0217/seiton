import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PaneKind } from "../windowing/bus";
import type { PaneWindow } from "../windowing/host";
import { SplitView } from "../windowing/SplitView";
import { useWorkspace } from "../windowing/Workspace";
import { DeviceList } from "./DeviceList";
import { PreviewPane } from "./PreviewPane";
import { ThumbnailsPane } from "./ThumbnailsPane";
import { useLibrary } from "./useLibrary";

export const PANE_TITLE: Record<PaneKind, string> = { thumbnails: "一覧", preview: "プレビュー" };

const PANE_ORDER: PaneKind[] = ["thumbnails", "preview"];

export function PaneContent({ kind }: { kind: PaneKind }) {
  return kind === "thumbnails" ? <ThumbnailsPane /> : <PreviewPane />;
}

interface PaneFrameProps {
  kind: PaneKind;
  actions: ReactNode;
}

/** A titled region with pane actions (pop out, hide, dock...). */
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

interface External {
  window: PaneWindow;
  kind: PaneKind;
  /** Put the pane back into the main window when this window closes. */
  dockOnClose: boolean;
}

/**
 * Main window: device list plus up to two panes in a split view. Any pane
 * can be moved to its own window (and docked back), and extra windows can
 * be opened, e.g. a second thumbnail list on another monitor.
 */
export function Library() {
  const { host, bus } = useWorkspace();
  const lib = useLibrary();
  const [docked, setDocked] = useState<PaneKind[]>(PANE_ORDER);
  const [externals, setExternals] = useState<External[]>([]);
  const [error, setError] = useState<string | null>(null);
  const externalsRef = useRef(externals);
  useEffect(() => {
    externalsRef.current = externals;
  }, [externals]);

  const dock = useCallback((kind: PaneKind) => {
    setDocked((prev) => (prev.includes(kind) ? prev : PANE_ORDER.filter((k) => k === kind || prev.includes(k))));
  }, []);

  const open = useCallback(
    async (kind: PaneKind, dockOnClose: boolean) => {
      setError(null);
      try {
        const win = await host.openPane(kind);
        setExternals((prev) => [...prev, { window: win, kind, dockOnClose }]);
        win.onClosed(() => {
          const ext = externalsRef.current.find((e) => e.window.id === win.id);
          setExternals((prev) => prev.filter((e) => e.window.id !== win.id));
          if (ext?.dockOnClose) dock(ext.kind);
        });
        return true;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    [dock, host],
  );

  async function popOut(kind: PaneKind) {
    if (await open(kind, true)) setDocked((prev) => prev.filter((k) => k !== kind));
  }

  // A pane window asked to be docked: re-dock when it closes.
  useEffect(
    () =>
      bus.subscribe((msg) => {
        if (msg.type !== "dock") return;
        setExternals((prev) => prev.map((e) => (e.window.id === msg.from ? { ...e, dockOnClose: true } : e)));
        dock(msg.pane);
      }),
    [bus, dock],
  );

  // Pane windows do not outlive the main window (Rust does the same in Tauri).
  useEffect(() => {
    const closeAll = () => externalsRef.current.forEach((e) => e.window.close());
    window.addEventListener("pagehide", closeAll);
    return () => window.removeEventListener("pagehide", closeAll);
  }, []);

  const hidden = PANE_ORDER.filter((k) => !docked.includes(k) && !externals.some((e) => e.kind === k && e.dockOnClose));

  function paneActions(kind: PaneKind) {
    const last = docked.length === 1;
    return (
      <>
        <button
          type="button"
          onClick={() => void popOut(kind)}
          disabled={last}
          title={last ? "最後のパネルは移動できません" : undefined}
        >
          別ウィンドウで開く
        </button>
        {!last && (
          <button type="button" onClick={() => setDocked((prev) => prev.filter((k) => k !== kind))}>
            閉じる
          </button>
        )}
      </>
    );
  }

  const [firstKind, secondKind] = docked;

  return (
    <div className="library">
      <aside className="sidebar">
        <h2>デバイス</h2>
        {lib.devices.isPending && <p>検出中…</p>}
        {lib.devices.isError && <p role="alert">デバイスを取得できません: {String(lib.devices.error)}</p>}
        {lib.devices.data && (
          <DeviceList devices={lib.devices.data} selectedId={lib.deviceId} onSelect={lib.selectDevice} />
        )}

        <h2>ウィンドウ</h2>
        <div className="window-actions">
          {hidden.map((k) => (
            <button key={k} type="button" onClick={() => dock(k)}>
              {PANE_TITLE[k]}を表示
            </button>
          ))}
          <button type="button" onClick={() => void open("thumbnails", false)}>
            新しい一覧ウィンドウ
          </button>
          <button type="button" onClick={() => void open("preview", false)}>
            新しいプレビューウィンドウ
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        {externals.length > 0 && (
          <ul className="external-list" aria-label="開いているウィンドウ">
            {externals.map((e) => (
              <li key={e.window.id}>
                <span>{PANE_TITLE[e.kind]}</span>
                <button type="button" onClick={() => e.window.focus()}>
                  前面へ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dock(e.kind);
                    e.window.close();
                  }}
                >
                  メインに戻す
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="workspace">
        {firstKind && secondKind ? (
          <SplitView
            first={<PaneFrame kind={firstKind} actions={paneActions(firstKind)} />}
            second={<PaneFrame kind={secondKind} actions={paneActions(secondKind)} />}
          />
        ) : (
          firstKind && <PaneFrame kind={firstKind} actions={paneActions(firstKind)} />
        )}
      </div>
    </div>
  );
}

/** Root of a pane window: one pane plus a "back to main" action. */
export function PaneWindowLayout({ kind }: { kind: PaneKind }) {
  const { host, bus } = useWorkspace();
  const lib = useLibrary();

  function dockBack() {
    bus.publish({ type: "dock", from: host.windowId, pane: kind });
    host.closeSelf();
  }

  return (
    <div className="pane-window">
      <p className="pane-window-device">{lib.device ? lib.device.label : "デバイス未選択"}</p>
      <PaneFrame
        kind={kind}
        actions={
          <button type="button" onClick={dockBack}>
            メインウィンドウに戻す
          </button>
        }
      />
    </div>
  );
}
