import { describe, expect, it } from "vitest";
import type { AssetView, ImportRequest, ImportSettings } from "../api";
import { filesToImport, planImport } from "./plan";
import {
  DEFAULT_IMPORT_SETTINGS,
  effectiveTemplate,
  joinPath,
  parseTemplate,
  renderFolders,
  simpleTemplate,
  type TemplateContext,
} from "./template";

const ctx: TemplateContext = { captureTime: "2026-09-20T10:15:30", stars: 3, kind: "raw" };

function render(template: string, c = ctx) {
  const parsed = parseTemplate(template);
  if (!parsed.ok) throw new Error(parsed.error.code);
  return renderFolders(parsed.segments, c);
}

describe("parseTemplate / renderFolders", () => {
  it("expands date, time, star and file variables", () => {
    expect(render("{yyyy}-{MM}-{dd}/{HH}-{mm}-{ss}/star{star}/{file}")).toEqual([
      "2026-09-20",
      "10-15-30",
      "star3",
      "RAW",
    ]);
    expect(render("{yy}{MM}{dd}")).toEqual(["260920"]);
    expect(render("{file}", { ...ctx, kind: "jpeg" })).toEqual(["JPG"]);
    expect(render("{file}", { ...ctx, kind: "sidecar" })).toEqual(["META"]);
  });

  it("keeps literal text, including letters that look like date codes", () => {
    expect(render("Photos/mm dd")).toEqual(["Photos", "mm dd"]);
  });

  it("ignores empty segments and uses 'unknown' without a capture time", () => {
    expect(render("/{yyyy}//x/", { ...ctx, captureTime: null })).toEqual(["unknown", "x"]);
    expect(render("")).toEqual([]);
  });

  it.each([
    ["{foo}", { code: "unknownVariable", token: "foo" }],
    ["{yyyy", { code: "unclosedBrace" }],
    ["a}", { code: "strayBrace" }],
    ["a\\b", { code: "backslash" }],
    ["a:b", { code: "forbiddenChar", char: ":" }],
    ["../x", { code: "dotSegment", name: ".." }],
    ["photos.", { code: "trailingDotOrSpace" }],
  ])("rejects %s", (template, error) => {
    expect(parseTemplate(template)).toEqual({ ok: false, error });
  });
});

describe("simple settings", () => {
  it("builds the equivalent template", () => {
    expect(simpleTemplate({ byDate: true, byHour: true, byRating: true, splitRawJpeg: true })).toBe(
      "{yyyy}-{MM}-{dd}/{HH}/star{star}/{file}",
    );
    expect(simpleTemplate({ byDate: false, byHour: false, byRating: false, splitRawJpeg: false })).toBe("");
    expect(effectiveTemplate({ ...DEFAULT_IMPORT_SETTINGS.folders, mode: "advanced", template: "x" })).toBe("x");
  });
});

describe("joinPath", () => {
  it("follows the root's separator style", () => {
    expect(joinPath("D:\\Photos\\", ["2026-09-20", "RAW"], "IMG_0001.CR3")).toBe(
      "D:\\Photos\\2026-09-20\\RAW\\IMG_0001.CR3",
    );
    expect(joinPath("/Users/me/Pictures/", [], "a.JPG")).toBe("/Users/me/Pictures/a.JPG");
  });
});

function asset(id: string, rating: number | null, kinds: AssetView["files"][number]["kind"][]): AssetView {
  const ext = { raw: "CR3", jpeg: "JPG", heif: "HIF", video: "MP4", sidecar: "XMP" } as const;
  return {
    id,
    deviceId: "d",
    name: id,
    captureTime: "2026-09-20T10:15:30",
    files: kinds.map((kind) => ({ name: `${id}.${ext[kind]}`, path: `DCIM/${id}.${ext[kind]}`, kind, size: 10 })),
    rating,
    ratingSource: null,
    imported: false,
  };
}

const everything: ImportRequest = { deviceId: "d", ratings: [0, 1, 2, 3, 4, 5], media: ["image", "video", "metadata"] };

describe("filesToImport", () => {
  const perRating: ImportSettings = {
    ...DEFAULT_IMPORT_SETTINGS,
    formats: {
      mode: "perRating",
      uniform: "rawAndJpeg",
      perRating: ["jpegOnly", "jpegOnly", "rawAndJpeg", "rawAndJpeg", "rawAndJpeg", "rawOnly"],
    },
  };
  const names = (a: AssetView, s = perRating, r = everything) => filesToImport(a, s, r).map((f) => f.name);

  it("applies the per-rating format (★1 JPG only, ★2 both, ★5 RAW only)", () => {
    expect(names(asset("a", 1, ["raw", "jpeg"]))).toEqual(["a.JPG"]);
    expect(names(asset("b", 2, ["raw", "jpeg"]))).toEqual(["b.CR3", "b.JPG"]);
    expect(names(asset("c", 5, ["raw", "heif"]))).toEqual(["c.CR3"]);
    expect(names(asset("d", null, ["raw", "heif"]))).toEqual(["d.HIF"]);
  });

  it("filters by rating and media category", () => {
    expect(names(asset("a", 3, ["raw", "jpeg"]), perRating, { ...everything, ratings: [4, 5] })).toEqual([]);
    expect(names(asset("v", 3, ["video"]), perRating, { ...everything, media: ["image"] })).toEqual([]);
    expect(names(asset("x", 3, ["raw", "sidecar"]), perRating, { ...everything, media: ["metadata"] })).toEqual([
      "x.XMP",
    ]);
  });
});

describe("planImport", () => {
  it("computes destinations and totals", () => {
    const settings: ImportSettings = {
      ...DEFAULT_IMPORT_SETTINGS,
      destinationRoot: "D:\\Photos",
      folders: { ...DEFAULT_IMPORT_SETTINGS.folders, simple: { byDate: true, byHour: false, byRating: false, splitRawJpeg: true } },
    };
    const plan = planImport([asset("a", 3, ["raw", "jpeg"]), asset("b", 0, ["video"])], settings, everything);
    expect(plan.problems).toEqual([]);
    expect(plan.assetCount).toBe(2);
    expect(plan.bytes).toBe(30);
    expect(plan.files.map((f) => f.destination)).toEqual([
      "D:\\Photos\\2026-09-20\\RAW\\a.CR3",
      "D:\\Photos\\2026-09-20\\JPG\\a.JPG",
      "D:\\Photos\\2026-09-20\\VIDEO\\b.MP4",
    ]);
  });

  it("reports why it cannot start", () => {
    const bad: ImportSettings = {
      ...DEFAULT_IMPORT_SETTINGS,
      folders: { ...DEFAULT_IMPORT_SETTINGS.folders, mode: "advanced", template: "{nope}" },
    };
    const plan = planImport([asset("a", 3, ["raw"])], bad, { ...everything, media: [] });
    expect(plan.problems).toEqual([
      { code: "noDestination" },
      { code: "badTemplate", error: { code: "unknownVariable", token: "nope" } },
      { code: "noMedia" },
    ]);
  });
});
