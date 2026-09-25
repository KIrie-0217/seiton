import { useState } from "react";
import { Button } from "react-aria-components";
import { open } from "@tauri-apps/plugin-dialog";
import { scanFolder, type FolderScan } from "./api";
import { formatSize } from "./format";
import { useI18n } from "./i18n";
import { KIND_LABEL } from "./library/AssetGrid";

type State =
  | { status: "idle" }
  | { status: "scanning"; path: string }
  | { status: "done"; path: string; result: FolderScan }
  | { status: "error"; message: string };

/** Picks a folder (SD card) and lists its media grouped by shot. */
export function FolderBrowser() {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ status: "idle" });

  async function pickFolder() {
    const selected = await open({ directory: true, multiple: false, title: t.chooseCardFolder });
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
    <section className="folder-browser" aria-labelledby="folder-heading">
      <h2 id="folder-heading">{t.openFolder}</h2>
      <Button className="secondary" onPress={() => void pickFolder()} isDisabled={state.status === "scanning"}>
        {t.chooseFolder}
      </Button>

      <div aria-live="polite">
        {state.status === "scanning" && <p className="hint">{t.scanning(state.path)}</p>}
        {state.status === "error" && <p role="alert">{t.error(state.message)}</p>}
        {state.status === "done" && (
          <p>{t.scanSummary(state.result.sourceLabel, state.result.profileName, state.result.groups.length)}</p>
        )}
      </div>

      {state.status === "done" && state.result.groups.length > 0 && (
        <table className="groups">
          <caption className="visually-hidden">{t.folderTable}</caption>
          <thead>
            <tr>
              <th scope="col">{t.name}</th>
              <th scope="col">{t.type}</th>
              <th scope="col">{t.files}</th>
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
                        {f.name} <span className="size tabular">{formatSize(f.size)}</span>
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
