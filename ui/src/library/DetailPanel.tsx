import type { AssetView } from "../api";
import { formatSize } from "../format";
import { KIND_LABEL } from "./AssetGrid";
import { starsOf } from "./filter";
import { useThumbnail } from "./queries";
import { StarInput } from "./StarRating";

/** `2026-09-20T10:15:30` -> `2026/09/20 10:15:30`. */
export function formatCaptureTime(value: string | null): string {
  if (!value) return "不明";
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value);
  return m ? `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}:${m[6]}` : value;
}

function Preview({ asset }: { asset: AssetView }) {
  const { data } = useThumbnail(asset.id);
  return data ? <img className="preview" src={data} alt={`${asset.name} のプレビュー`} /> : <div className="preview thumb-loading" />;
}

interface DetailPanelProps {
  selected: AssetView[];
  onRate: (rating: number | null) => void;
  saving: boolean;
}

/** Details of the selection and a rating editor. */
export function DetailPanel({ selected, onRate, saving }: DetailPanelProps) {
  if (selected.length === 0) {
    return (
      <aside className="detail" aria-label="詳細">
        <p>写真または動画を選択してください。</p>
      </aside>
    );
  }

  const ratings = new Set(selected.map(starsOf));
  const value = ratings.size === 1 ? [...ratings][0]! : "mixed";

  if (selected.length > 1) {
    return (
      <aside className="detail" aria-label="詳細">
        <h2>{selected.length} 件を選択中</h2>
        <StarInput value={value} onChange={onRate} disabled={saving} />
      </aside>
    );
  }

  const asset = selected[0]!;
  const source = asset.ratingSource === "camera" ? "カメラ" : asset.ratingSource === "app" ? "seiton" : "-";
  return (
    <aside className="detail" aria-label="詳細">
      <Preview asset={asset} />
      <h2>{asset.name}</h2>
      <StarInput value={value} onChange={onRate} disabled={saving} />
      <dl>
        <dt>撮影日時</dt>
        <dd>{formatCaptureTime(asset.captureTime)}</dd>
        <dt>評価の出所</dt>
        <dd>{source}</dd>
        <dt>取り込み</dt>
        <dd>{asset.imported ? "取り込み済み" : "未取り込み"}</dd>
      </dl>
      <h3>ファイル</h3>
      <ul className="file-list">
        {asset.files.map((f) => (
          <li key={f.path}>
            <span className="badge">{KIND_LABEL[f.kind]}</span> {f.name}{" "}
            <span className="size">({formatSize(f.size)})</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
