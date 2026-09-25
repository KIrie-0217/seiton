import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { scanFolder, type FolderScan, type MediaKind } from "./api";

const KIND_LABEL: Record<MediaKind, string> = {
  raw: "RAW",
  heif: "HEIF",
  jpeg: "JPEG",
  video: "動画",
  sidecar: "XMP",
};

export function formatSize(bytes: number | null): string {
  if (bytes === null) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

type State =
  | { status: "idle" }
  | { status: "scanning"; path: string }
  | { status: "done"; path: string; result: FolderScan }
  | { status: "error"; message: string };

/** Picks a folder (SD card) and lists its media grouped by shot. */
export function FolderBrowser() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function pickFolder() {
    const selected = await open({ directory: true, multiple: false, title: "カードのフォルダを選択" });
    if (typeof selected !== "string") return;
    setState({ status: "scanning", path: selected });
    try {
      const result = await scanFolder(selected);
      setState({ status: "done", path: selected, result });
    } catch (error: unknown) {
      setState({ status: "error", message: String(error) });
    }
  }

  return (
    <section aria-labelledby="folder-heading">
      <h2 id="folder-heading">フォルダから読み込む</h2>
      <button type="button" onClick={pickFolder} disabled={state.status === "scanning"}>
        フォルダを選択…
      </button>

      <div aria-live="polite">
        {state.status === "scanning" && <p>読み込み中: {state.path}</p>}
        {state.status === "error" && <p role="alert">エラー: {state.message}</p>}
        {state.status === "done" && (
          <p>
            {state.result.sourceLabel}（プロファイル: {state.result.profileName}）:{" "}
            {state.result.groups.length} 件
          </p>
        )}
      </div>

      {state.status === "done" && state.result.groups.length > 0 && (
        <table className="groups">
          <caption className="visually-hidden">撮影ごとのファイル一覧</caption>
          <thead>
            <tr>
              <th scope="col">名前</th>
              <th scope="col">種類</th>
              <th scope="col">ファイル</th>
            </tr>
          </thead>
          <tbody>
            {state.result.groups.map((group) => (
              <tr key={group.key}>
                <th scope="row">{group.name}</th>
                <td>{group.files.map((f) => KIND_LABEL[f.kind]).join(" + ")}</td>
                <td>
                  <ul>
                    {group.files.map((f) => (
                      <li key={f.path}>
                        {f.name} <span className="size">({formatSize(f.size)})</span>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
