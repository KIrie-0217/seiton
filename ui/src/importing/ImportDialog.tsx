import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { MediaCategory } from "../api";
import { formatSize } from "../format";
import { CloseIcon, IconButton } from "../icons";
import { useLibrary } from "../library/useLibrary";
import { ALL_MEDIA, ALL_RATINGS, planImport } from "./plan";
import { useImportSettings, useImportStatus, useStartImport } from "./queries";
import { DEFAULT_IMPORT_SETTINGS, RATING_LABELS } from "./template";

interface CheckGroupProps<T extends string | number> {
  legend: string;
  allLabel: string;
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onChange: (selected: T[]) => void;
}

/** Checkboxes with an "all" box linked to them (indeterminate when partial). */
function CheckGroup<T extends string | number>({ legend, allLabel, options, selected, onChange }: CheckGroupProps<T>) {
  const allRef = useRef<HTMLInputElement>(null);
  const all = selected.length === options.length;
  const some = selected.length > 0 && !all;
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = some;
  }, [some]);

  return (
    <fieldset className="check-group">
      <legend>{legend}</legend>
      <label className="check-all">
        <input
          ref={allRef}
          type="checkbox"
          checked={all}
          aria-checked={some ? "mixed" : all}
          onChange={() => onChange(all ? [] : options.map((o) => o.value))}
        />
        {allLabel}
      </label>
      {options.map((o) => (
        <label key={String(o.value)}>
          <input
            type="checkbox"
            checked={selected.includes(o.value)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? options.map((x) => x.value).filter((v) => v === o.value || selected.includes(v))
                  : selected.filter((v) => v !== o.value),
              )
            }
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

const RATING_OPTIONS = ALL_RATINGS.map((value) => ({ value, label: RATING_LABELS[value] }));
const MEDIA_OPTIONS: { value: MediaCategory; label: string }[] = [
  { value: "image", label: "画像" },
  { value: "video", label: "動画" },
  { value: "metadata", label: "メタデータ" },
];

interface ImportDialogProps {
  onClose: () => void;
}

/** Modal to choose what to import from the current device, then start. */
export function ImportDialog({ onClose }: ImportDialogProps) {
  const lib = useLibrary();
  const settings = useImportSettings().data ?? DEFAULT_IMPORT_SETTINGS;
  const status = useImportStatus().data;
  const start = useStartImport();
  const [ratings, setRatings] = useState<number[]>([...ALL_RATINGS]);
  const [media, setMedia] = useState<MediaCategory[]>([...ALL_MEDIA]);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const request = useMemo(
    () => ({ deviceId: lib.deviceId ?? "", ratings, media }),
    [lib.deviceId, ratings, media],
  );
  const plan = useMemo(() => planImport(lib.all, settings, request), [lib.all, settings, request]);
  const running = status?.state === "running";
  const problems = [...(lib.deviceId ? [] : ["デバイスが選択されていません"]), ...(running ? ["取り込みを実行中です"] : []), ...plan.problems];

  // Focus the dialog on open; restore focus to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    return () => opener?.focus?.();
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    // Keep Tab inside the dialog.
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("input, button, select") ?? [])].filter(
      (el) => !el.hasAttribute("disabled"),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function begin() {
    start.mutate(request, { onSuccess: onClose });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <header className="modal-header">
          <h2 id={titleId}>取り込み</h2>
          <IconButton label="閉じる" icon={<CloseIcon />} onClick={onClose} />
        </header>

        <p className="modal-device">対象: {lib.device?.label ?? "-"}</p>

        <CheckGroup legend="評価" allLabel="全て" options={RATING_OPTIONS} selected={ratings} onChange={setRatings} />
        <CheckGroup legend="メディア形式" allLabel="全て" options={MEDIA_OPTIONS} selected={media} onChange={setMedia} />

        <p className="modal-summary" aria-live="polite">
          {plan.assetCount} 件・{plan.files.length} ファイル（{formatSize(plan.bytes)}）
        </p>
        <p className="hint">保存形式と保存先は Import Settings の設定を使います。</p>
        {problems.length > 0 && (
          <ul className="modal-problems">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {start.isError && <p role="alert">開始できません: {String(start.error)}</p>}

        <footer className="modal-footer">
          <button type="button" onClick={onClose}>
            キャンセル
          </button>
          <button type="button" className="primary" onClick={begin} disabled={problems.length > 0 || start.isPending}>
            取り込み開始
          </button>
        </footer>
      </div>
    </div>
  );
}
