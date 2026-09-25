import { Button, Input, Label, Text, TextField } from "react-aria-components";
import { canPickDirectory, pickDirectory, type ImportSettings, type SaveFormats } from "../api";
import { Checkbox, SelectField } from "../controls";
import { useI18n } from "../i18n";
import { ALL_RATINGS, DESTINATION_PLACEHOLDER } from "./plan";
import { useImportSettings, useSaveImportSettings } from "./queries";
import {
  DEFAULT_IMPORT_SETTINGS,
  effectiveTemplate,
  joinPath,
  parseTemplate,
  renderFolders,
  simpleTemplate,
  TEMPLATE_VARIABLES,
} from "./template";

const FORMAT_VALUES: SaveFormats[] = ["rawOnly", "rawAndJpeg", "jpegOnly"];
const SIMPLE_KEYS = ["byDate", "byHour", "byRating", "splitRawJpeg"] as const;
const SAMPLE = { name: "IMG_0001", captureTime: "2026-09-20T10:15:30", stars: 3 };

/** Example destinations for the current folder settings. */
function Examples({ settings }: { settings: ImportSettings }) {
  const { t } = useI18n();
  const parsed = parseTemplate(effectiveTemplate(settings.folders));
  if (!parsed.ok) {
    return (
      <p className="field-error" role="alert">
        {t.templateError(parsed.error)}
      </p>
    );
  }
  const root = settings.destinationRoot || DESTINATION_PLACEHOLDER;
  const samples = [
    { kind: "raw" as const, file: `${SAMPLE.name}.CR3` },
    { kind: "jpeg" as const, file: `${SAMPLE.name}.JPG` },
  ];
  return (
    <div className="examples">
      <p className="hint">{t.example}</p>
      <ul>
        {samples.map((s) => (
          <li key={s.kind}>
            <code>
              {joinPath(
                root,
                renderFolders(parsed.segments, { captureTime: SAMPLE.captureTime, stars: SAMPLE.stars, kind: s.kind }),
                s.file,
              )}
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Default import settings: the order form. Saved on every change and shared by every window. */
export function ImportSettingsPane() {
  const { t } = useI18n();
  const query = useImportSettings();
  const save = useSaveImportSettings();

  if (query.isPending) return <p className="pane-body hint">{t.loading}</p>;
  if (query.isError) return <p role="alert">{t.settingsLoadError(String(query.error))}</p>;
  const settings = query.data ?? DEFAULT_IMPORT_SETTINGS;
  const f = settings.formats;
  const folders = settings.folders;
  const formatOptions = FORMAT_VALUES.map((v) => ({ value: v, label: t.saveFormat[v]! }));

  function update(next: ImportSettings) {
    save.mutate(next);
  }

  async function browse() {
    const picked = await pickDirectory(t.chooseDestination);
    if (picked) update({ ...settings, destinationRoot: picked });
  }

  return (
    <div className="pane-body import-settings">
      <form onSubmit={(e) => e.preventDefault()} aria-label={t.importSettingsForm}>
        <div className="form-section" role="group" aria-label={t.formats}>
          <h3 className="form-section-title" aria-hidden="true">
            {t.formats}
          </h3>
          <SelectField
            className="row"
            label={t.formatsByRating}
            value={f.mode}
            options={[
              { value: "uniform", label: t.formatMode.uniform! },
              { value: "perRating", label: t.formatMode.perRating! },
            ]}
            onChange={(mode) => update({ ...settings, formats: { ...f, mode } })}
          />
          {f.mode === "uniform" ? (
            <SelectField
              className="row"
              label={t.format}
              value={f.uniform}
              options={formatOptions}
              onChange={(uniform) => update({ ...settings, formats: { ...f, uniform } })}
            />
          ) : (
            <ul className="per-rating" aria-label={t.perRatingList}>
              {ALL_RATINGS.map((stars) => (
                <li key={stars}>
                  <SelectField
                    className="row"
                    label={t.ratingName(stars)}
                    value={f.perRating[stars] ?? f.uniform}
                    options={formatOptions}
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
          <p className="hint">{t.formatsHint}</p>
        </div>

        <div className="form-section" role="group" aria-label={t.destination}>
          <h3 className="form-section-title" aria-hidden="true">
            {t.destination}
          </h3>
          <TextField
            className="text-field"
            value={settings.destinationRoot ?? ""}
            onChange={(v) => update({ ...settings, destinationRoot: v || null })}
          >
            <Label>{t.destinationFolder}</Label>
            <div className="input-with-button">
              <Input placeholder={t.destinationPlaceholder} />
              <Button className="secondary" onPress={() => void browse()} isDisabled={!canPickDirectory()}>
                {t.browse}
              </Button>
            </div>
            {!canPickDirectory() && (
              <Text slot="description" className="hint">
                {t.browseUnavailable}
              </Text>
            )}
          </TextField>
        </div>

        <div className="form-section" role="group" aria-label={t.folderLayout}>
          <h3 className="form-section-title" aria-hidden="true">
            {t.folderLayout}
          </h3>
          <SelectField
            className="row"
            label={t.folderMode}
            value={folders.mode}
            options={[
              { value: "simple", label: t.folderModes.simple! },
              { value: "advanced", label: t.folderModes.advanced! },
            ]}
            onChange={(mode) => {
              // Start the template from the current simple layout.
              const template = mode === "advanced" ? simpleTemplate(folders.simple) || folders.template : folders.template;
              update({ ...settings, folders: { ...folders, mode, template } });
            }}
          />

          {folders.mode === "simple" ? (
            <div className="checkbox-list">
              {SIMPLE_KEYS.map((key) => (
                <Checkbox
                  key={key}
                  isSelected={folders.simple[key]}
                  onChange={(on) =>
                    update({ ...settings, folders: { ...folders, simple: { ...folders.simple, [key]: on } } })
                  }
                >
                  {t.simpleFolders[key]}
                </Checkbox>
              ))}
            </div>
          ) : (
            <TextField
              className="text-field"
              value={folders.template}
              onChange={(template) => update({ ...settings, folders: { ...folders, template } })}
            >
              <Label>{t.folderTemplate}</Label>
              <Input className="mono" spellCheck={false} />
              <Text slot="description" className="hint template-help">
                {t.templateHelp}
              </Text>
              <dl className="variables">
                {TEMPLATE_VARIABLES.map((v) => (
                  <div key={v.token}>
                    <dt>
                      <code>{`{${v.token}}`}</code>
                    </dt>
                    <dd>
                      {t.variables[v.token]} <span className="example-value">{v.example}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </TextField>
          )}
          <Examples settings={settings} />
        </div>
        {save.isError && <p role="alert">{t.settingsSaveError(String(save.error))}</p>}
      </form>
    </div>
  );
}
