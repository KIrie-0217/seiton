import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { CloseIcon, DockIcon, FocusIcon, GripIcon, IconButton, PopOutIcon, ShowIcon } from "../icons";
import type { PaneKind } from "../windowing/bus";
import type { PaneWindow } from "../windowing/host";
import { SplitView } from "../windowing/SplitView";
import { useWorkspace } from "../windowing/Workspace";
import { DeviceList } from "./DeviceList";
import { PreviewPane } from "./PreviewPane";
import { ThumbnailsPane } from "./ThumbnailsPane";
import { useLibrary } from "./useLibrary";

export const PANE_TITLE: Record<PaneKind, string> = { thumbnails: "Thumbnails", preview: "Preview" };

const PANE_ORDER: PaneKind[] = ["thumbnails", "preview"];

/** Drag data type carrying the pane kind between windows. */
export const PANE_MIME = "application/x-seiton-pane";

function isPaneKind(v: unknown): v is PaneKind {
  return v === "thumbnails" || v === "preview";
}

export function PaneContent({ kind }: { kind: PaneKind }) {
  return kind === "thumbnails" ? <ThumbnailsPane /> : <PreviewPane />;
}

interface PaneFrameProps {
  kind: PaneKind;
  actions: ReactNode;
  /** Makes the header a drag handle (pane windows: drop onto the main window). */
  dragHandle?: {
    onDragStart: (e: DragEvent) => void;
    onDragEnd: (e: DragEvent) => void;
  };
}

/** A titled region with icon actions. */
export function PaneFrame({ kind, actions, dragHandle }: PaneFrameProps) {
  const headingId = `pane-${kind}-heading`;
  return (
    <section className="pane" aria-labelledby={headingId}>
      <header
        className={`pane-header${dragHandle ? " draggable" : ""}`}
        draggable={dragHandle ? true : undefined}
        onDragStart={dragHandle?.onDragStart}
        onDragEnd={dragHandle?.onDragEnd}
        title={dragHandle ? "メインウィンドウへドラッグして結合" : undefined}
      >
        {dragHandle && (
          <span className="drag-grip">
            <GripIcon />
          </span>
        )}
        <h2 id={headingId}>{PANE_TITLE[kind]}</h2>
        <div className="pane-actions">{actions}</div>
      </header>
      <PaneContent kind={kind} />
    </section>
  );
}

type Placement = "first" | "second";

/** Inserts `kind` into the docked list (max two, no duplicates). */
function placePane(docked: PaneKind[], kind: PaneKind, at?: Placement): PaneKind[] {
  const others = docked.filter((k) => k !== kind);
  if (at === "first") return [kind, ...others];
  if (at === "second") return [...others, kind];
  return docked.includes(kind) ? docked : PANE_ORDER.filter((k) => k === kind || docked.includes(k));
}

/**
 * Main window: devices plus up to two panes in a split view. Each pane
 * exists once: docked here, in its own window, or hidden. A pane window is
 * docked back by closing it, with its dock button, or by dragging its
 * header onto this window.
 */
export function Library() {
  const { host, bus } = useWorkspace();
  const lib = useLibrary();
  const [docked, setDocked] = useState<PaneKind[]>(PANE_ORDER);
  const [externals, setExternals] = useState<Partial<Record<PaneKind, PaneWindow>>>({});
  const [dragging, setDragging] = useState<PaneKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const externalsRef = useRef(externals);
  useEffect(() => {
    externalsRef.current = externals;
  }, [externals]);

  const dock = useCallback((kind: PaneKind, at?: Placement) => {
    setDocked((prev) => placePane(prev, kind, at));
  }, []);

  /** Docks `kind` and closes its window if it has one. */
  const dockAndClose = useCallback(
    (kind: PaneKind, at?: Placement) => {
      dock(kind, at);
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
        switch (msg.type) {
          case "dock":
            dock(msg.pane);
            break;
          case "paneDragStart":
            setDragging(msg.pane);
            break;
          case "paneDragEnd":
            setDragging((cur) => (cur === msg.pane ? null : cur));
            break;
          default:
            break;
        }
      }),
    [bus, dock],
  );

  // Pane windows do not outlive the main window (Rust does the same in Tauri).
  useEffect(() => {
    const closeAll = () => Object.values(externalsRef.current).forEach((w) => w?.close());
    window.addEventListener("pagehide", closeAll);
    return () => window.removeEventListener("pagehide", closeAll);
  }, []);

  // ---- drop target ----

  function draggedPane(e: DragEvent): PaneKind | null {
    const data = e.dataTransfer?.getData(PANE_MIME);
    if (isPaneKind(data)) return data;
    // Some platforms do not carry custom drag data across windows; fall
    // back to what the pane window announced on the bus.
    return dragging;
  }

  function acceptsDrag(e: DragEvent): boolean {
    return Boolean(dragging) || Boolean(e.dataTransfer?.types.includes(PANE_MIME));
  }

  function onZoneDragOver(e: DragEvent) {
    if (!acceptsDrag(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  }

  function onWorkspaceDragEnter(e: DragEvent) {
    if (!dragging && e.dataTransfer?.types.includes(PANE_MIME)) {
      // Drag data is readable only on drop; show the zones for a pane that
      // is in its own window (the drop reads the real kind).
      const guess = PANE_ORDER.find((k) => externalsRef.current[k]);
      if (guess) setDragging(guess);
    }
  }

  function onZoneDrop(e: DragEvent, at: Placement) {
    const kind = draggedPane(e);
    e.preventDefault();
    setDragging(null);
    if (kind && externalsRef.current[kind]) dockAndClose(kind, at);
  }

  const dropping = dragging !== null && externals[dragging] !== undefined;

  // ---- render ----

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

  const [firstKind, secondKind] = docked;

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
          {PANE_ORDER.map((kind) => {
            const ext = externals[kind];
            const isDocked = docked.includes(kind);
            const status = ext ? "別ウィンドウ" : isDocked ? "メインウィンドウ" : "非表示";
            return (
              <li key={kind}>
                <span className="window-name">{PANE_TITLE[kind]}</span>
                <span className="window-status">{status}</span>
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

      <div className="workspace" onDragEnter={onWorkspaceDragEnter}>
        {firstKind && secondKind ? (
          <SplitView
            first={<PaneFrame kind={firstKind} actions={paneActions(firstKind)} />}
            second={<PaneFrame kind={secondKind} actions={paneActions(secondKind)} />}
          />
        ) : (
          firstKind && <PaneFrame kind={firstKind} actions={paneActions(firstKind)} />
        )}

        {dropping && (
          <div className="drop-overlay" aria-label="結合する位置">
            {(["first", "second"] as const).map((at) => (
              <div
                key={at}
                className="drop-zone"
                role="region"
                aria-label={at === "first" ? "左側に結合" : "右側に結合"}
                onDragOver={onZoneDragOver}
                onDragEnter={onZoneDragOver}
                onDrop={(e) => onZoneDrop(e, at)}
              >
                {at === "first" ? "← 左側に結合" : "右側に結合 →"}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Root of a pane window: one pane; dock back by button or drag and drop. */
export function PaneWindowLayout({ kind }: { kind: PaneKind }) {
  const { host, bus } = useWorkspace();
  const lib = useLibrary();

  function dockBack() {
    bus.publish({ type: "dock", from: host.windowId, pane: kind });
    host.closeSelf();
  }

  function onDragStart(e: DragEvent) {
    e.dataTransfer?.setData(PANE_MIME, kind);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    bus.publish({ type: "paneDragStart", from: host.windowId, pane: kind });
  }

  function onDragEnd() {
    bus.publish({ type: "paneDragEnd", from: host.windowId, pane: kind });
  }

  return (
    <div className="pane-window">
      <p className="pane-window-device">{lib.device ? lib.device.label : "デバイス未選択"}</p>
      <PaneFrame
        kind={kind}
        dragHandle={{ onDragStart, onDragEnd }}
        actions={
          <IconButton label={`${PANE_TITLE[kind]} をメインウィンドウに戻す`} icon={<DockIcon />} onClick={dockBack} />
        }
      />
    </div>
  );
}
