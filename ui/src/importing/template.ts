import type { FolderSettings, ImportSettings, MediaKind, SaveFormats, SimpleFolders } from "../api";

/**
 * Folder templates.
 *
 * A template is a `/`-separated list of folder names that may contain
 * variables in braces, e.g. `{yyyy}-{MM}-{dd}/{file}`. Braces keep
 * variables unambiguous next to literal text (a folder named "mm" stays
 * literal). File names are always kept as on the card.
 */

export const TEMPLATE_VARIABLES = [
  { token: "yyyy", label: "年（4 桁）", example: "2026" },
  { token: "yy", label: "年（2 桁）", example: "26" },
  { token: "MM", label: "月", example: "09" },
  { token: "dd", label: "日", example: "20" },
  { token: "HH", label: "時（24 時間）", example: "10" },
  { token: "mm", label: "分", example: "15" },
  { token: "ss", label: "秒", example: "30" },
  { token: "star", label: "星の数（未評価は 0）", example: "3" },
  { token: "file", label: "ファイル形式（RAW / JPG / HEIF / VIDEO / META）", example: "RAW" },
] as const;

export type TemplateToken = (typeof TEMPLATE_VARIABLES)[number]["token"];

export type TemplatePart = { type: "text"; value: string } | { type: "token"; token: TemplateToken };

export type ParsedTemplate = { ok: true; segments: TemplatePart[][] } | { ok: false; error: string };

const TOKENS = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.token));
// Characters Windows does not allow in names, plus `\` (use `/` between folders).
const FORBIDDEN = /[<>:"\\|?*]/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f]/;

export const FILE_FOLDER: Record<MediaKind, string> = {
  raw: "RAW",
  jpeg: "JPG",
  heif: "HEIF",
  video: "VIDEO",
  sidecar: "META",
};

function fail(error: string): ParsedTemplate {
  return { ok: false, error };
}

export function parseTemplate(template: string): ParsedTemplate {
  const segments: TemplatePart[][] = [];
  for (const raw of template.split("/")) {
    const name = raw.trim() === "" ? "" : raw;
    if (name === "") continue;
    if (name === "." || name === "..") return fail(`フォルダ名「${name}」は使えません`);
    const parts: TemplatePart[] = [];
    let text = "";
    let i = 0;
    while (i < name.length) {
      const ch = name[i]!;
      if (ch === "{") {
        const end = name.indexOf("}", i);
        if (end < 0) return fail("「{」が閉じていません");
        const token = name.slice(i + 1, end);
        if (!TOKENS.has(token)) return fail(`不明な変数 {${token}} があります`);
        if (text) parts.push({ type: "text", value: text });
        text = "";
        parts.push({ type: "token", token: token as TemplateToken });
        i = end + 1;
        continue;
      }
      if (ch === "}") return fail("対応する「{」のない「}」があります");
      if (FORBIDDEN.test(ch) || CONTROL.test(ch)) {
        return fail(ch === "\\" ? "フォルダの区切りには「/」を使ってください" : `フォルダ名に使えない文字「${ch}」があります`);
      }
      text += ch;
      i += 1;
    }
    if (text) parts.push({ type: "text", value: text });
    if (/[. ]$/.test(name)) return fail("フォルダ名の末尾に「.」や空白は使えません");
    segments.push(parts);
  }
  return { ok: true, segments };
}

export interface TemplateContext {
  /** Local capture time `YYYY-MM-DDTHH:MM:SS`, or null when unknown. */
  captureTime: string | null;
  stars: number;
  kind: MediaKind;
}

function tokenValue(token: TemplateToken, ctx: TemplateContext): string {
  if (token === "star") return String(ctx.stars);
  if (token === "file") return FILE_FOLDER[ctx.kind];
  const m = ctx.captureTime && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(ctx.captureTime);
  if (!m) return "unknown";
  const [, y, mo, d, h, mi, s] = m;
  const values: Record<string, string> = { yyyy: y!, yy: y!.slice(2), MM: mo!, dd: d!, HH: h!, mm: mi!, ss: s! };
  return values[token]!;
}

/** Folder names for a file (without root and file name). */
export function renderFolders(segments: TemplatePart[][], ctx: TemplateContext): string[] {
  return segments.map((parts) => parts.map((p) => (p.type === "text" ? p.value : tokenValue(p.token, ctx))).join(""));
}

/** The template equivalent of the simple (checkbox) settings. */
export function simpleTemplate(simple: SimpleFolders): string {
  const segments: string[] = [];
  if (simple.byDate) segments.push("{yyyy}-{MM}-{dd}");
  if (simple.byHour) segments.push("{HH}");
  if (simple.byRating) segments.push("star{star}");
  if (simple.splitRawJpeg) segments.push("{file}");
  return segments.join("/");
}

export function effectiveTemplate(folders: FolderSettings): string {
  return folders.mode === "simple" ? simpleTemplate(folders.simple) : folders.template;
}

/** Joins with the root's separator style (`\` for Windows paths). */
export function joinPath(root: string, folders: string[], fileName: string): string {
  const sep = root.includes("\\") && !root.includes("/") ? "\\" : "/";
  const base = root.replace(/[\\/]+$/, "");
  return [base, ...folders, fileName].join(sep);
}

export const RATING_LABELS = ["未評価", "★1", "★2", "★3", "★4", "★5"] as const;

export const SAVE_FORMAT_LABELS: Record<SaveFormats, string> = {
  rawOnly: "RAW のみ",
  rawAndJpeg: "JPG + RAW",
  jpegOnly: "JPG のみ",
};

export const DEFAULT_IMPORT_SETTINGS: ImportSettings = {
  formats: {
    mode: "uniform",
    uniform: "rawAndJpeg",
    perRating: ["jpegOnly", "jpegOnly", "rawAndJpeg", "rawAndJpeg", "rawAndJpeg", "rawAndJpeg"],
  },
  destinationRoot: null,
  folders: {
    mode: "simple",
    simple: { byDate: true, byHour: false, byRating: false, splitRawJpeg: false },
    template: "{yyyy}-{MM}-{dd}",
  },
};
