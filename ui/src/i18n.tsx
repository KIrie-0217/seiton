import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { I18nProvider as AriaI18nProvider } from "react-aria-components";

/**
 * UI text.
 *
 * Labels (headings, buttons, field names, options, badges) are English in
 * every locale: seiton's interface vocabulary is English. Supplementary text
 * (hints, explanations, empty states, errors, status sentences) follows the
 * locale, so `ja` reads as English labels with Japanese guidance.
 */
export type Locale = "en" | "ja";

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
];

type TemplateErrorCode =
  | { code: "dotSegment"; name: string }
  | { code: "unclosedBrace" }
  | { code: "unknownVariable"; token: string }
  | { code: "strayBrace" }
  | { code: "backslash" }
  | { code: "forbiddenChar"; char: string }
  | { code: "trailingDotOrSpace" };

export type { TemplateErrorCode };

export type ImportProblem =
  | { code: "noDestination" }
  | { code: "badTemplate"; error: TemplateErrorCode }
  | { code: "noRatings" }
  | { code: "noMedia" }
  | { code: "nothingMatches" }
  | { code: "noDevice" }
  | { code: "running" };

const stars = (n: number) => (n === 1 ? "1 star" : `${n} stars`);

/** Labels: identical in every locale. */
const labels = {
  appName: "seiton",
  language: "Language",
  devices: "Devices",
  windows: "Windows",
  paneTitle: { thumbnails: "Thumbnails", preview: "Preview", import: "Import Settings" } as Record<string, string>,
  windowState: { docked: "Main window", external: "Own window", hidden: "Hidden" },
  transport: { mtp: "USB", massStorage: "SD card", vendor: "Vendor SDK" } as Record<string, string>,
  shotCount: (n: number) => (n === 1 ? "1 shot" : `${n} shots`),
  popOut: (title: string) => `Open ${title} in its own window`,
  hidePane: (title: string) => `Hide ${title}`,
  focusWindow: (title: string) => `Bring ${title} to front`,
  dockWindow: (title: string) => `Dock ${title} into the main window`,
  showPane: (title: string) => `Show ${title}`,
  splitMain: "Resize Thumbnails and side panes",
  splitRight: "Resize Preview and Import Settings",
  splitDefault: "Resize panes",
  // thumbnails
  filter: "Filter",
  rating: "Rating",
  ratingFilter: {
    all: "All",
    unrated: "Unrated",
    "1": "1+ stars",
    "2": "2+ stars",
    "3": "3+ stars",
    "4": "4+ stars",
    "5": "5 stars",
  } as Record<string, string>,
  type: "Type",
  kind: { raw: "RAW", heif: "HEIF", jpeg: "JPG", video: "Video", sidecar: "Sidecar" } as Record<string, string>,
  hideImported: "Hide imported",
  count: (shown: number, total: number, selected: number) =>
    `${shown} of ${total}${selected > 0 ? ` · ${selected} selected` : ""}`,
  frames: "Frames",
  frameNumber: (n: number) => `Frame ${n}`,
  imported: "Imported",
  unrated: "Unrated",
  starsLabel: stars,
  rateAsset: (name: string, n: number) => `Rate ${name} ${stars(n)}`,
  clearAssetRating: (name: string) => `Clear rating of ${name}`,
  // preview
  details: "Details",
  selectedCount: (n: number) => `${n} selected`,
  mixed: " (mixed)",
  noRating: "No rating",
  captured: "Captured",
  ratingFrom: "Rating from",
  importState: "Import",
  ratingSource: { camera: "Camera", app: "seiton" } as Record<string, string>,
  notImported: "Not imported",
  files: "Files",
  previewAlt: (name: string) => `Preview of ${name}`,
  // folder browser
  openFolder: "Open a folder",
  chooseFolder: "Choose folder…",
  folderTable: "Files per shot",
  name: "Name",
  // import settings
  importSettingsForm: "Import settings",
  formats: "Formats",
  formatsByRating: "Apply to",
  formatMode: { uniform: "All ratings", perRating: "Each rating separately" } as Record<string, string>,
  format: "Format",
  saveFormat: { rawOnly: "RAW only", rawAndJpeg: "JPG + RAW", jpegOnly: "JPG only" } as Record<string, string>,
  perRatingList: "Format per rating",
  ratingName: (n: number) => (n === 0 ? "Unrated" : stars(n)),
  destination: "Destination",
  destinationFolder: "Destination folder",
  destinationPlaceholder: "e.g. D:\\Photos",
  destinationToken: "<destination>",
  browse: "Browse…",
  folderLayout: "Folder layout",
  folderMode: "Mode",
  folderModes: { simple: "Simple", advanced: "Template" } as Record<string, string>,
  simpleFolders: {
    byDate: "By date",
    byHour: "By hour",
    byRating: "By rating",
    splitRawJpeg: "Separate RAW and JPG",
  } as Record<string, string>,
  folderTemplate: "Folder template",
  // import dialog and progress
  import: "Import",
  close: "Close",
  cancel: "Cancel",
  startImport: "Start import",
  source: "Source",
  all: "All",
  media: "Media",
  mediaCategory: { image: "Images", video: "Video", metadata: "Metadata" } as Record<string, string>,
  summary: (assets: number, files: number, size: string) =>
    `${assets} ${assets === 1 ? "shot" : "shots"} · ${files} ${files === 1 ? "file" : "files"} · ${size}`,
  importStatus: "Import status",
  importProgress: "Import progress",
  cancelImport: "Cancel import",
  dismiss: "Dismiss",
};

/** Supplementary text in English. */
const en = {
  ...labels,
  loading: "Loading…",
  error: (message: string) => `Error: ${message}`,
  detecting: "Looking for devices…",
  devicesError: (e: string) => `Could not list devices: ${e}`,
  noDevices: "Connect a camera or insert an SD card.",
  noDevice: "No device selected",
  lastPane: "The last pane stays in the main window.",
  popupBlocked: "The browser blocked the window. Allow pop-ups for this page.",
  dockOverlay: (title: string) => `Release to dock ${title} into the main window.`,
  dockHint: "Drag this window onto the main window to dock it.",
  listError: (e: string) => `Could not list the frames: ${e}`,
  rateError: (e: string) => `Could not save the rating: ${e}`,
  noMatches: "No frames match the filter.",
  shortcuts: "Arrows move · Space selects · 0–5 rate (0 clears) · Ctrl/⌘-click adds to the selection",
  thumbError: "Unavailable",
  selectFrame: "Select a frame to see it here.",
  unknownTime: "Unknown",
  scanning: (path: string) => `Reading ${path}`,
  scanSummary: (label: string, profile: string, n: number) => `${label} (profile: ${profile}): ${n} shots`,
  chooseCardFolder: "Choose the card folder",
  settingsLoadError: (e: string) => `Could not load the settings: ${e}`,
  settingsSaveError: (e: string) => `Could not save the settings: ${e}`,
  formatsHint: "JPG includes HEIF. Video and metadata follow the choice in the import dialog.",
  browseUnavailable: "Folder picking is not available in the browser mock. Type the path instead.",
  chooseDestination: "Choose the destination folder",
  templateHelp: "Separate folders with /. {variables} are replaced with each shot's details. File names stay as on the card.",
  variables: {
    yyyy: "Year (4 digits)",
    yy: "Year (2 digits)",
    MM: "Month",
    dd: "Day",
    HH: "Hour (24h)",
    mm: "Minute",
    ss: "Second",
    star: "Stars (0 when unrated)",
    file: "File type (RAW / JPG / HEIF / VIDEO / META)",
  } as Record<string, string>,
  example: "Example: 3 stars, taken 2026-09-20 10:15:30",
  templateError: (e: TemplateErrorCode): string => {
    switch (e.code) {
      case "dotSegment":
        return `A folder cannot be named “${e.name}”.`;
      case "unclosedBrace":
        return "A “{” is not closed.";
      case "unknownVariable":
        return `Unknown variable {${e.token}}.`;
      case "strayBrace":
        return "A “}” has no matching “{”.";
      case "backslash":
        return "Use “/” to separate folders.";
      case "forbiddenChar":
        return `Folder names cannot contain “${e.char}”.`;
      case "trailingDotOrSpace":
        return "Folder names cannot end with “.” or a space.";
    }
  },
  problem: (p: ImportProblem): string => {
    switch (p.code) {
      case "noDestination":
        return "Set a destination folder in Import Settings.";
      case "badTemplate":
        return `The folder layout is invalid: ${en.templateError(p.error)}`;
      case "noRatings":
        return "Select at least one rating.";
      case "noMedia":
        return "Select at least one media type.";
      case "nothingMatches":
        return "No files match these choices.";
      case "noDevice":
        return "No device is selected.";
      case "running":
        return "An import is already running.";
    }
  },
  importHint: "Formats and destination come from Import Settings.",
  startError: (e: string) => `Could not start the import: ${e}`,
  importRunning: "An import is running.",
  progressRunning: (done: number, total: number, percent: number) =>
    `Importing ${done} of ${total} files (${percent}%)`,
  progressCompleted: (n: number, size: string) => `Imported ${n} ${n === 1 ? "file" : "files"} (${size})`,
  progressCancelled: (done: number, total: number) => `Import cancelled after ${done} of ${total} files`,
  progressFailed: (e: string) => `Import failed: ${e}`,
  unknownError: "unknown error",
  idleSummary: (frames: number, device: string) => `${frames} frames on ${device}`,
  noDestinationYet: "Set a destination in Import Settings.",
};

export type Messages = typeof en;

/** Japanese: English labels, Japanese supplementary text. */
const ja: Messages = {
  ...en,
  loading: "読み込み中…",
  error: (message) => `エラー: ${message}`,
  detecting: "デバイスを探しています…",
  devicesError: (e) => `デバイスを取得できません: ${e}`,
  noDevices: "カメラを接続するか、SD カードを挿してください。",
  noDevice: "デバイス未選択",
  lastPane: "最後のパネルはメインウィンドウに残ります。",
  popupBlocked: "ポップアップがブロックされました。このページのポップアップを許可してください。",
  dockOverlay: (title) => `離すと ${title} をメインウィンドウに戻します。`,
  dockHint: "このウィンドウをメインウィンドウの上へドラッグすると戻せます。",
  listError: (e) => `一覧を取得できません: ${e}`,
  rateError: (e) => `評価を保存できません: ${e}`,
  noMatches: "条件に一致する写真・動画はありません。",
  shortcuts: "矢印キーで移動、Space で選択、0〜5 で評価（0 で解除）、Ctrl/⌘+クリックで追加選択",
  thumbError: "読み込めません",
  selectFrame: "写真または動画を選ぶと、ここに表示されます。",
  unknownTime: "不明",
  scanning: (path) => `読み込み中: ${path}`,
  scanSummary: (label, profile, n) => `${label}（プロファイル: ${profile}）: ${n} 件`,
  chooseCardFolder: "カードのフォルダを選択",
  settingsLoadError: (e) => `設定を読み込めません: ${e}`,
  settingsSaveError: (e) => `設定を保存できません: ${e}`,
  formatsHint: "JPG には HEIF を含みます。動画とメタデータは取り込み時の選択に従います。",
  browseUnavailable: "ブラウザのモックではフォルダを選べません。パスを直接入力してください。",
  chooseDestination: "保存先フォルダを選択",
  templateHelp: "「/」でフォルダを区切ります。{変数} は撮影ごとの情報に置き換わります。ファイル名はカードと同じです。",
  variables: {
    yyyy: "年（4 桁）",
    yy: "年（2 桁）",
    MM: "月",
    dd: "日",
    HH: "時（24 時間）",
    mm: "分",
    ss: "秒",
    star: "星の数（未評価は 0）",
    file: "ファイル形式（RAW / JPG / HEIF / VIDEO / META）",
  },
  example: "例: ★3、2026/09/20 10:15:30 撮影",
  templateError: (e) => {
    switch (e.code) {
      case "dotSegment":
        return `フォルダ名「${e.name}」は使えません。`;
      case "unclosedBrace":
        return "「{」が閉じていません。";
      case "unknownVariable":
        return `不明な変数 {${e.token}} があります。`;
      case "strayBrace":
        return "対応する「{」のない「}」があります。";
      case "backslash":
        return "フォルダの区切りには「/」を使ってください。";
      case "forbiddenChar":
        return `フォルダ名に「${e.char}」は使えません。`;
      case "trailingDotOrSpace":
        return "フォルダ名の末尾に「.」や空白は使えません。";
    }
  },
  problem: (p) => {
    switch (p.code) {
      case "noDestination":
        return "Import Settings で保存先フォルダを設定してください。";
      case "badTemplate":
        return `フォルダ構成が正しくありません: ${ja.templateError(p.error)}`;
      case "noRatings":
        return "評価を 1 つ以上選んでください。";
      case "noMedia":
        return "メディア形式を 1 つ以上選んでください。";
      case "nothingMatches":
        return "条件に一致するファイルがありません。";
      case "noDevice":
        return "デバイスが選択されていません。";
      case "running":
        return "取り込みを実行中です。";
    }
  },
  importHint: "保存形式と保存先は Import Settings の設定を使います。",
  startError: (e) => `取り込みを開始できません: ${e}`,
  importRunning: "取り込みを実行中です。",
  progressRunning: (done, total, percent) => `取り込み中 ${done} / ${total} ファイル（${percent}%）`,
  progressCompleted: (n, size) => `取り込み完了: ${n} ファイル（${size}）`,
  progressCancelled: (done, total) => `取り込みを中止しました（${done} / ${total} ファイル）`,
  progressFailed: (e) => `取り込みに失敗しました: ${e}`,
  unknownError: "不明なエラー",
  idleSummary: (frames, device) => `${device} に ${frames} コマ`,
  noDestinationYet: "Import Settings で保存先を設定してください。",
};

export const MESSAGES: Record<Locale, Messages> = { en, ja };

const STORAGE_KEY = "seiton.locale";

/** Saved choice, else the system language (Japanese systems get `ja`). */
export function initialLocale(): Locale {
  // `?lang=ja` / `?lang=en` (used for review captures) wins over the saved choice.
  const fromUrl = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("lang");
  if (fromUrl === "en" || fromUrl === "ja") return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ja") return saved;
  } catch {
    // Storage unavailable: fall through to the system language.
  }
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
}

interface I18n {
  locale: Locale;
  t: Messages;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18n>({ locale: "en", t: en, setLocale: () => {} });

export function I18nProvider({ children, locale: fixed }: { children: ReactNode; locale?: Locale }) {
  const [locale, setState] = useState<Locale>(() => fixed ?? initialLocale());
  const setLocale = useCallback((next: Locale) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice just isn't remembered.
    }
    document.documentElement.lang = next;
  }, []);
  const value = useMemo(() => ({ locale, t: MESSAGES[locale], setLocale }), [locale, setLocale]);
  // React Aria's own strings and number/date formatting follow the same locale.
  return (
    <I18nContext.Provider value={value}>
      <AriaI18nProvider locale={locale === "ja" ? "ja-JP" : "en-US"}>{children}</AriaI18nProvider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
