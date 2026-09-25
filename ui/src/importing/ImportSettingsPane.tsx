import { useId } from "react";
import { canPickDirectory, pickDirectory, type ImportSettings, type SaveFormats } from "../api";
import { useImportSettings, useSaveImportSettings } from "./queries";
import {
  DEFAULT_IMPORT_SETTINGS,
  effectiveTemplate,
  joinPath,
  parseTemplate,
  RATING_LABELS,
  renderFolders,
  SAVE_FORMAT_LABELS,
  simpleTemplate,
  TEMPLATE_VARIABLES,
} from "./template";

const FORMAT_OPTIONS = Object.entries(SAVE_FORMAT_LABELS) as [SaveFormats, string][];

function FormatSelect({ value, onChange, label }: { value: SaveFormats; onChange: (v: SaveFormats) => void; label: string }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as SaveFormats)}>
        {FORMAT_OPTIONS.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </>
  );
}

const SAMPLE = { name: "IMG_0001", captureTime: "2026-09-20T10:15:30", stars: 3 };

/** Example destinations for the current folder settings. */
function Examples({ settings }: { settings: ImportSettings }) {
  const parsed = parseTemplate(effectiveTemplate(settings.folders));
  if (!parsed.ok) {
    return (
      <p className="field-error" role="alert">
        {parsed.error}
      </p>
    );
  }
  const root = settings.destinationRoot || "<保存先>";
  const samples = [
    { kind: "raw" as const, file: `${SAMPLE.name}.CR3` },
    { kind: "jpeg" as const, file: `${SAMPLE.name}.JPG` },
  ];
  return (
    <div className="examples">
      <p className="hint">例（★{SAMPLE.stars}、2026/09/20 10:15:30 撮影）</p>
      <ul>
        {samples.map((s) => (
          <li key={s.kind}>
            <code>
              {joinPath(root, renderFolders(parsed.segments, { captureTime: SAMPLE.captureTime, stars: SAMPLE.stars, kind: s.kind }), s.file)}
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Default import settings. Saved immediately and shared by every window. */
export function ImportSettingsPane() {
  const query = useImportSettings();
  const save = useSaveImportSettings();
  const ids = { mode: useId(), root: useId(), folderMode: useId(), template: useId(), templateHelp: useId() };

  if (query.isPending) return <p className="pane-body">読み込み中…</p>;
  if (query.isError) return <p role="alert">設定を読み込めません: {String(query.error)}</p>;
  const settings = query.data ?? DEFAULT_IMPORT_SETTINGS;

  function update(next: ImportSettings) {
    save.mutate(next);
  }
  const f = settings.formats;
  const folders = settings.folders;

  async function browse() {
    const picked = await pickDirectory("保存先フォルダを選択");
    if (picked) update({ ...settings, destinationRoot: picked });
  }

  return (
    <div className="pane-body import-settings">
      <form onSubmit={(e) => e.preventDefault()} aria-label="取り込み設定">
        <fieldset>
          <legend>保存する形式</legend>
          <div className="field">
            <label htmlFor={ids.mode}>保存設定</label>
            <select
              id={ids.mode}
              value={f.mode}
              onChange={(e) => update({ ...settings, formats: { ...f, mode: e.target.value as typeof f.mode } })}
            >
              <option value="uniform">全てに同じ設定を適用</option>
              <option value="perRating">星ごとに個別に設定</option>
            </select>
          </div>
          {f.mode === "uniform" ? (
            <div className="field">
              <FormatSelect
                label="形式"
                value={f.uniform}
                onChange={(v) => update({ ...settings, formats: { ...f, uniform: v } })}
              />
            </div>
          ) : (
            <ul className="per-rating" aria-label="星ごとの形式">
              {RATING_LABELS.map((label, stars) => (
                <li key={label} className="field">
                  <FormatSelect
                    label={label}
                    value={f.perRating[stars] ?? f.uniform}
                    onChange={(v) => {
                      const perRating = [...f.perRating];
                      perRating[stars] = v;
                      update({ ...settings, formats: { ...f, perRating } });
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="hint">JPG には HEIF を含みます。動画とメタデータは取り込み時の選択に従います。</p>
        </fieldset>

        <fieldset>
          <legend>保存先</legend>
          <div className="field field-wide">
            <label htmlFor={ids.root}>保存先フォルダ</label>
            <div className="input-with-button">
              <input
                id={ids.root}
                type="text"
                value={settings.destinationRoot ?? ""}
                placeholder="例: D:\Photos"
                onChange={(e) => update({ ...settings, destinationRoot: e.target.value || null })}
              />
              <button
                type="button"
                onClick={() => void browse()}
                disabled={!canPickDirectory()}
                title={canPickDirectory() ? undefined : "ブラウザのモックではフォルダ選択を開けません。直接入力してください。"}
              >
                参照…
              </button>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>保存先フォルダの構成</legend>
          <div className="field">
            <label htmlFor={ids.folderMode}>設定方法</label>
            <select
              id={ids.folderMode}
              value={folders.mode}
              onChange={(e) => {
                const mode = e.target.value as typeof folders.mode;
                // Start the advanced template from the current simple layout.
                const template = mode === "advanced" ? simpleTemplate(folders.simple) || folders.template : folders.template;
                update({ ...settings, folders: { ...folders, mode, template } });
              }}
            >
              <option value="simple">簡単設定</option>
              <option value="advanced">高度な設定</option>
            </select>
          </div>

          {folders.mode === "simple" ? (
            <div className="checkbox-list">
              {(
                [
                  ["byDate", "日付でフォルダを分ける"],
                  ["byHour", "時間でフォルダを分ける"],
                  ["byRating", "星ごとにフォルダを分ける"],
                  ["splitRawJpeg", "RAW と JPG を別フォルダにする"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={folders.simple[key]}
                    onChange={(e) =>
                      update({ ...settings, folders: { ...folders, simple: { ...folders.simple, [key]: e.target.checked } } })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          ) : (
            <div className="field field-wide">
              <label htmlFor={ids.template}>フォルダ名のテンプレート</label>
              <input
                id={ids.template}
                type="text"
                className="mono"
                value={folders.template}
                aria-describedby={ids.templateHelp}
                spellCheck={false}
                onChange={(e) => update({ ...settings, folders: { ...folders, template: e.target.value } })}
              />
              <div id={ids.templateHelp} className="hint">
                <p>
                  「/」でフォルダを区切ります。<code>{"{変数}"}</code> は撮影情報に置き換わります。ファイル名はカードと同じです。
                </p>
                <dl className="variables">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <div key={v.token}>
                      <dt>
                        <code>{`{${v.token}}`}</code>
                      </dt>
                      <dd>
                        {v.label}（例: {v.example}）
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}
          <Examples settings={settings} />
        </fieldset>
        {save.isError && <p role="alert">設定を保存できません: {String(save.error)}</p>}
      </form>
    </div>
  );
}
