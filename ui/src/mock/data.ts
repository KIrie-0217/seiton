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

/**
 * A placeholder thumbnail for mock data: a quiet grayscale "print" whose tone
 * and horizon vary per asset, marked MOCK so it is never mistaken for a
 * real photo.
 */
export function placeholderThumbnail(asset: AssetView): string {
  let hash = 2166136261;
  for (const ch of asset.id) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  const tone = 150 + (hash % 70); // sky lightness 150–219
  const ground = tone - 60 - ((hash >>> 8) % 30);
  const horizon = 120 + ((hash >>> 16) % 70);
  const peak = 40 + ((hash >>> 4) % 240);
  const isVideo = asset.files.some((f) => f.kind === "video");
  const gray = (v: number) => `rgb(${v},${v},${v})`;
  const video = isVideo
    ? `<circle cx="160" cy="${horizon - 20}" r="26" fill="rgba(255,255,255,0.85)"/><polygon points="152,${horizon - 34} 152,${horizon - 6} 175,${horizon - 20}" fill="${gray(ground - 20)}"/>`
    : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 213">` +
    `<rect width="320" height="213" fill="${gray(tone)}"/>` +
    `<polygon points="0,213 0,${horizon} ${peak},${horizon - 70} ${peak + 90},${horizon - 10} 320,${horizon - 40} 320,213" fill="${gray(ground)}"/>` +
    `<rect y="${horizon + 30}" width="320" height="${213 - horizon}" fill="${gray(ground - 25)}"/>` +
    video +
    `<text x="308" y="203" text-anchor="end" font-family="sans-serif" font-size="11" letter-spacing="1" fill="rgba(255,255,255,0.8)">MOCK</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
