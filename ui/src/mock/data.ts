import type { AssetView, DeviceView, FileView, MediaKind } from "../api";

/** Small deterministic PRNG (mulberry32) so mock data is stable across reloads. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MB = 1024 * 1024;

type Shape = { kinds: MediaKind[]; weight: number };

const SHAPES: Shape[] = [
  { kinds: ["raw", "jpeg"], weight: 5 },
  { kinds: ["jpeg"], weight: 2 },
  { kinds: ["raw"], weight: 1 },
  { kinds: ["raw", "heif"], weight: 1 },
  { kinds: ["video"], weight: 1 },
  // A metadata sidecar next to the image (XMP; Sony cameras write clip XML).
  { kinds: ["raw", "jpeg", "sidecar"], weight: 1 },
];

const EXT: Record<MediaKind, string> = {
  raw: "CR3",
  heif: "HIF",
  jpeg: "JPG",
  video: "MP4",
  sidecar: "XMP",
};

const SIZE_MB: Record<MediaKind, [number, number]> = {
  raw: [22, 34],
  heif: [4, 9],
  jpeg: [5, 12],
  video: [120, 900],
  sidecar: [0.004, 0.02],
};

function pick<T extends { weight: number }>(items: T[], r: number): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let x = r * total;
  for (const item of items) {
    x -= item.weight;
    if (x < 0) return item;
  }
  return items[items.length - 1]!;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function localIso(d: Date): string {
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}` +
    `T${pad(d.getUTCHours(), 2)}:${pad(d.getUTCMinutes(), 2)}:${pad(d.getUTCSeconds(), 2)}`
  );
}

type DeviceSpec = Omit<DeviceView, "assetCount"> & { count: number; seed: number; start: string };

const DEVICE_SPECS: DeviceSpec[] = [
  {
    id: "mock:mtp:eos-r6m2",
    label: "Canon EOS R6 Mark II",
    transport: "mtp",
    profileId: "canon",
    profileName: "Canon",
    count: 50,
    seed: 20260920,
    start: "2026-09-20T08:30:00Z",
  },
  {
    id: "mock:fs:eos-digital",
    label: "EOS_DIGITAL (SD)",
    transport: "massStorage",
    profileId: "canon",
    profileName: "Canon",
    count: 8,
    seed: 20260812,
    start: "2026-08-12T15:00:00Z",
  },
];

function makeAssets(spec: DeviceSpec): AssetView[] {
  const r = rng(spec.seed);
  let time = new Date(spec.start).getTime();
  const assets: AssetView[] = [];
  for (let i = 0; i < spec.count; i += 1) {
    // Bursts of shots a few seconds apart, with occasional longer gaps.
    time += r() < 0.15 ? Math.floor(r() * 5 * 3600) * 1000 : Math.floor(2 + r() * 90) * 1000;
    const shape = pick(SHAPES, r());
    const number = 1 + i;
    const prefix = shape.kinds[0] === "video" ? "MVI" : "IMG";
    const name = `${prefix}_${pad(number, 4)}`;
    const folder = `DCIM/${100 + Math.floor(i / 40)}CANON`;
    const files: FileView[] = shape.kinds.map((kind) => {
      const [lo, hi] = SIZE_MB[kind];
      const fileName = `${name}.${EXT[kind]}`;
      return { name: fileName, path: `${folder}/${fileName}`, kind, size: Math.round((lo + r() * (hi - lo)) * MB) };
    });
    // About half of the shots were rated on the camera.
    const rated = r() < 0.5;
    const rating = rated ? Math.floor(r() * 6) : null;
    assets.push({
      id: `${spec.id}/${folder}/${name}`,
      deviceId: spec.id,
      name,
      captureTime: localIso(new Date(time)),
      files,
      rating,
      ratingSource: rating === null ? null : "camera",
      imported: r() < 0.2,
    });
  }
  return assets;
}

export interface MockData {
  devices: DeviceView[];
  assets: Map<string, AssetView[]>;
}

/** Builds a fresh, deterministic data set (two devices, 58 assets in total). */
export function createMockData(): MockData {
  const assets = new Map<string, AssetView[]>();
  const devices = DEVICE_SPECS.map(({ count, seed, start, ...device }) => {
    const list = makeAssets({ ...device, count, seed, start });
    assets.set(device.id, list);
    return { ...device, assetCount: list.length };
  });
  return { devices, assets };
}

/** A placeholder thumbnail: an SVG with a per-asset color and the file name. */
export function placeholderThumbnail(asset: AssetView): string {
  let hash = 0;
  for (const ch of asset.id) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const isVideo = asset.files.some((f) => f.kind === "video");
  const icon = isVideo
    ? `<polygon points="138,95 138,145 180,120" fill="white" fill-opacity="0.85"/>`
    : `<circle cx="210" cy="60" r="22" fill="white" fill-opacity="0.6"/><polygon points="0,240 110,110 190,200 240,150 320,240" fill="black" fill-opacity="0.25"/>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue} 55% 55%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 55% 30%)"/>` +
    `</linearGradient></defs><rect width="320" height="240" fill="url(#g)"/>${icon}` +
    `<text x="12" y="228" font-family="sans-serif" font-size="18" fill="white">${asset.name}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
