import type { AssetView, FileView, ImportRequest, ImportSettings, MediaCategory, MediaKind, SaveFormats } from "../api";
import { effectiveTemplate, joinPath, parseTemplate, renderFolders } from "./template";

export const ALL_RATINGS = [0, 1, 2, 3, 4, 5] as const;
export const ALL_MEDIA: readonly MediaCategory[] = ["image", "video", "metadata"];

export function categoryOf(kind: MediaKind): MediaCategory {
  if (kind === "video") return "video";
  if (kind === "sidecar") return "metadata";
  return "image";
}

export function formatsFor(settings: ImportSettings, stars: number): SaveFormats {
  const f = settings.formats;
  return f.mode === "uniform" ? f.uniform : (f.perRating[stars] ?? f.uniform);
}

/** Files of `asset` selected by the request and the save-format setting. */
export function filesToImport(asset: AssetView, settings: ImportSettings, request: ImportRequest): FileView[] {
  const stars = asset.rating ?? 0;
  if (!request.ratings.includes(stars)) return [];
  const formats = formatsFor(settings, stars);
  return asset.files.filter((f) => {
    const category = categoryOf(f.kind);
    if (!request.media.includes(category)) return false;
    if (category !== "image") return true;
    // HEIF counts as a developed image, like JPEG.
    return f.kind === "raw" ? formats !== "jpegOnly" : formats !== "rawOnly";
  });
}

export interface PlannedFile {
  asset: AssetView;
  file: FileView;
  destination: string;
}

export interface ImportPlan {
  files: PlannedFile[];
  assetCount: number;
  bytes: number;
  /** Why the import cannot start, if it cannot. */
  problems: string[];
}

export function planImport(assets: AssetView[], settings: ImportSettings, request: ImportRequest): ImportPlan {
  const problems: string[] = [];
  const root = settings.destinationRoot?.trim() ?? "";
  if (!root) problems.push("保存先フォルダが設定されていません（Import Settings）");
  const parsed = parseTemplate(effectiveTemplate(settings.folders));
  if (!parsed.ok) problems.push(`フォルダ構成が正しくありません: ${parsed.error}`);
  if (request.ratings.length === 0) problems.push("評価が 1 つも選ばれていません");
  if (request.media.length === 0) problems.push("メディア形式が 1 つも選ばれていません");

  const files: PlannedFile[] = [];
  let assetCount = 0;
  let bytes = 0;
  for (const asset of assets) {
    const selected = filesToImport(asset, settings, request);
    if (selected.length > 0) assetCount += 1;
    for (const file of selected) {
      bytes += file.size ?? 0;
      const folders = parsed.ok
        ? renderFolders(parsed.segments, { captureTime: asset.captureTime, stars: asset.rating ?? 0, kind: file.kind })
        : [];
      files.push({ asset, file, destination: joinPath(root || "<保存先>", folders, file.name) });
    }
  }
  if (problems.length === 0 && files.length === 0) problems.push("条件に一致するファイルがありません");
  return { files, assetCount, bytes, problems };
}
