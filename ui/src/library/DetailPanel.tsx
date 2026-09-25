import type { AssetView } from "../api";
import { formatSize } from "../format";
import { useI18n } from "../i18n";
import { KIND_LABEL } from "./AssetGrid";
import { starsOf } from "./filter";
import { useThumbnail } from "./queries";
import { StarInput } from "./StarRating";

/** `2026-09-20T10:15:30` -> `2026-09-20 10:15:30`. */
export function formatCaptureTime(value: string | null, unknown: string): string {
  if (!value) return unknown;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(value);
  return m ? `${m[1]} ${m[2]}` : value;
}

function Preview({ asset }: { asset: AssetView }) {
  const { t } = useI18n();
  const { data } = useThumbnail(asset.id);
  return (
    <div className="preview-frame">
      {data ? <img className="preview" src={data} alt={t.previewAlt(asset.name)} /> : <div className="preview thumb-loading" />}
    </div>
  );
}

interface DetailPanelProps {
  selected: AssetView[];
  onRate: (rating: number | null) => void;
  saving: boolean;
}

/** Details of the selection and a rating editor. */
export function DetailPanel({ selected, onRate, saving }: DetailPanelProps) {
  const { t } = useI18n();
  if (selected.length === 0) {
    return (
      <aside className="detail" aria-label={t.details}>
        <p className="empty-note">{t.selectFrame}</p>
      </aside>
    );
  }

  const ratings = new Set(selected.map(starsOf));
  const value = ratings.size === 1 ? [...ratings][0]! : "mixed";

  if (selected.length > 1) {
    return (
      <aside className="detail" aria-label={t.details}>
        <h3 className="detail-title">{t.selectedCount(selected.length)}</h3>
        <StarInput value={value} onChange={onRate} isDisabled={saving} />
      </aside>
    );
  }

  const asset = selected[0]!;
  const source = asset.ratingSource ? t.ratingSource[asset.ratingSource] : "–";
  return (
    <aside className="detail" aria-label={t.details}>
      <Preview asset={asset} />
      <h3 className="detail-title">{asset.name}</h3>
      <StarInput value={value} onChange={onRate} isDisabled={saving} />
      <dl className="detail-rows">
        <dt>{t.captured}</dt>
        <dd className="tabular">{formatCaptureTime(asset.captureTime, t.unknownTime)}</dd>
        <dt>{t.ratingFrom}</dt>
        <dd>{source}</dd>
        <dt>{t.importState}</dt>
        <dd>{asset.imported ? t.imported : t.notImported}</dd>
      </dl>
      <h4 className="section-label">{t.files}</h4>
      <ul className="file-list">
        {asset.files.map((f) => (
          <li key={f.path}>
            <span className="file-kind">{KIND_LABEL[f.kind]}</span>
            <span className="file-name">{f.name}</span>
            <span className="size tabular">{formatSize(f.size)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
