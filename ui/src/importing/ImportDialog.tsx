import { useMemo, useState } from "react";
import {
  Button,
  CheckboxGroup,
  CheckboxGroupStateContext,
  Dialog,
  Heading,
  Label,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import type { MediaCategory } from "../api";
import { Checkbox, IconButton } from "../controls";
import { formatSize } from "../format";
import { useI18n } from "../i18n";
import { CloseIcon } from "../icons";
import { useLibrary } from "../library/useLibrary";
import { ALL_MEDIA, ALL_RATINGS, planImport } from "./plan";
import { useImportSettings, useImportStatus, useStartImport } from "./queries";
import { DEFAULT_IMPORT_SETTINGS } from "./template";

interface CheckGroupProps<T extends string | number> {
  label: string;
  allLabel: string;
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onChange: (selected: T[]) => void;
}

/** A checkbox group with an "All" box linked to it (indeterminate when partial). */
function CheckGroup<T extends string | number>({ label, allLabel, options, selected, onChange }: CheckGroupProps<T>) {
  const all = selected.length === options.length;
  const some = selected.length > 0 && !all;
  const byKey = new Map(options.map((o) => [String(o.value), o.value]));
  return (
    <CheckboxGroup
      className="check-group"
      value={selected.map(String)}
      onChange={(keys) => onChange(options.map((o) => o.value).filter((v) => keys.includes(String(v))))}
    >
      <Label>{label}</Label>
      {/* Not part of the group's value: a standalone box that drives the others. */}
      <CheckboxGroupStateContext.Provider value={null}>
        <Checkbox
          className="check-all"
          isSelected={all}
          isIndeterminate={some}
          onChange={() => onChange(all ? [] : [...byKey.values()])}
        >
          {allLabel}
        </Checkbox>
      </CheckboxGroupStateContext.Provider>
      {options.map((o) => (
        <Checkbox key={String(o.value)} value={String(o.value)}>
          {o.label}
        </Checkbox>
      ))}
    </CheckboxGroup>
  );
}

const MEDIA_VALUES: readonly MediaCategory[] = ALL_MEDIA;

/**
 * Chooses what to import from the current device, then starts. Rendered
 * inside a `DialogTrigger`; React Aria handles focus, Escape and the backdrop.
 */
export function ImportDialog() {
  const { t } = useI18n();
  const lib = useLibrary();
  const settings = useImportSettings().data ?? DEFAULT_IMPORT_SETTINGS;
  const status = useImportStatus().data;
  const start = useStartImport();
  const [ratings, setRatings] = useState<number[]>([...ALL_RATINGS]);
  const [media, setMedia] = useState<MediaCategory[]>([...ALL_MEDIA]);

  const ratingOptions = ALL_RATINGS.map((value) => ({ value: value as number, label: t.ratingName(value) }));
  const mediaOptions = MEDIA_VALUES.map((value) => ({ value, label: t.mediaCategory[value]! }));

  const request = useMemo(() => ({ deviceId: lib.deviceId ?? "", ratings, media }), [lib.deviceId, ratings, media]);
  const plan = useMemo(() => planImport(lib.all, settings, request), [lib.all, settings, request]);
  const running = status?.state === "running";
  const problems = [
    ...(lib.deviceId ? [] : [{ code: "noDevice" as const }]),
    ...(running ? [{ code: "running" as const }] : []),
    ...plan.problems,
  ].map((p) => t.problem(p));

  return (
    <ModalOverlay className="modal-backdrop" isDismissable>
      <Modal className="modal">
        <Dialog className="dialog">
          {({ close }) => (
            <>
              <header className="modal-header">
                <Heading slot="title">{t.import}</Heading>
                <IconButton label={t.close} icon={<CloseIcon />} onPress={close} />
              </header>

              <dl className="modal-source">
                <dt>{t.source}</dt>
                <dd>{lib.device?.label ?? "–"}</dd>
              </dl>

              <CheckGroup label={t.rating} allLabel={t.all} options={ratingOptions} selected={ratings} onChange={setRatings} />
              <CheckGroup label={t.media} allLabel={t.all} options={mediaOptions} selected={media} onChange={setMedia} />

              <p className="modal-summary" aria-live="polite">
                {t.summary(plan.assetCount, plan.files.length, formatSize(plan.bytes))}
              </p>
              <p className="hint">{t.importHint}</p>
              {problems.length > 0 && (
                <ul className="modal-problems">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {start.isError && <p role="alert">{t.startError(String(start.error))}</p>}

              <footer className="modal-footer">
                <Button className="secondary" onPress={close}>
                  {t.cancel}
                </Button>
                <Button
                  className="primary"
                  isDisabled={problems.length > 0 || start.isPending}
                  onPress={() => start.mutate(request, { onSuccess: close })}
                >
                  {t.startImport}
                </Button>
              </footer>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
