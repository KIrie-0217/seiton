import type { FolderSettings, ImportSettings, MediaKind, SimpleFolders } from "../api";
import type { TemplateErrorCode } from "../i18n";

/**
 * Folder templates.
 *
 * A template is a `/`-separated list of folder names that may contain
 * variables in braces, e.g. `{yyyy}-{MM}-{dd}/{file}`. Braces keep
 * variables unambiguous next to literal text (a folder named "mm" stays
 * literal). File names are always kept as on the card.
 */

/** Variables, with an example value. Descriptions live in i18n. */
export const TEMPLATE_VARIABLES = [
  { token: "yyyy", example: "2026" },
  { token: "yy", example: "26" },
  { token: "MM", example: "09" },
  { token: "dd", example: "20" },
  { token: "HH", example: "10" },
  { token: "mm", example: "15" },
  { token: "ss", example: "30" },
  { token: "star", example: "3" },
  { token: "file", example: "RAW" },
] as const;

export type TemplateToken = (typeof TEMPLATE_VARIABLES)[number]["token"];

export type TemplatePart = { type: "text"; value: string } | { type: "token"; token: TemplateToken };

export type ParsedTemplate = { ok: true; segments: TemplatePart[][] } | { ok: false; error: TemplateErrorCode };

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

function fail(error: TemplateErrorCode): ParsedTemplate {
  return { ok: false, error };
}

export function parseTemplate(template: string): ParsedTemplate {
  const segments: TemplatePart[][] = [];
  for (const raw of template.split("/")) {
    const name = raw.trim() === "" ? "" : raw;
    if (name === "") continue;
    if (name === "." || name === "..") return fail({ code: "dotSegment", name });
    const parts: TemplatePart[] = [];
    let text = "";
    let i = 0;
    while (i < name.length) {
      const ch = name[i]!;
      if (ch === "{") {
        const end = name.indexOf("}", i);
        if (end < 0) return fail({ code: "unclosedBrace" });
        const token = name.slice(i + 1, end);
        if (!TOKENS.has(token)) return fail({ code: "unknownVariable", token });
        if (text) parts.push({ type: "text", value: text });
        text = "";
        parts.push({ type: "token", token: token as TemplateToken });
        i = end + 1;
        continue;
      }
      if (ch === "}") return fail({ code: "strayBrace" });
      if (FORBIDDEN.test(ch) || CONTROL.test(ch)) {
        return fail(ch === "\\" ? { code: "backslash" } : { code: "forbiddenChar", char: ch });
      }
      text += ch;
      i += 1;
    }
    if (text) parts.push({ type: "text", value: text });
    if (/[. ]$/.test(name)) return fail({ code: "trailingDotOrSpace" });
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
