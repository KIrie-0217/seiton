import type { AppInfo, AssetView, ImportProgress, ImportRequest, ImportSettings, RatingUpdate } from "../api";
import { setBackendOverride } from "../api";
import { planImport } from "../importing/plan";
import { DEFAULT_IMPORT_SETTINGS } from "../importing/template";
import { MESSAGES } from "../i18n";
import type { BusMessage } from "../windowing/bus";
import { createMockData, placeholderThumbnail, type MockData } from "./data";

export interface MockOptions {
  /** Simulated latency of list commands, in ms. */
  listDelayMs?: number;
  /** Simulated latency range of thumbnail loads, in ms. */
  thumbDelayMs?: [number, number];
  /** Simulated copy time: fixed per file plus per MB, in ms. */
  copyDelayMs?: { perFile: number; perMb: number };
  /** Where backend messages are published, like the Rust backend will. */
  publish?: (msg: BusMessage) => void;
  /**
   * Persists ratings, import state and settings so that every window's mock
   * backend (each window has its own JS context) sees the same values.
   * Defaults to localStorage.
   */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
}

const ASSETS_KEY = "seiton.mock.assets";
const SETTINGS_KEY = "seiton.mock.importSettings";

type AssetOverrides = Record<
  string,
  { rating?: number | null; source?: AssetView["ratingSource"]; imported?: boolean }
>;

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Handles app commands against in-memory data. Exposed separately from
 * {@link installMockBackend} so tests can drive it directly.
 */
export function createMockHandler(options: MockOptions = {}) {
  const {
    listDelayMs = 300,
    thumbDelayMs = [150, 600],
    copyDelayMs = { perFile: 40, perMb: 2 },
    publish,
  } = options;
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const data = createMockData();
  let job: { progress: ImportProgress; cancelled: boolean } | null = null;
  let jobCounter = 0;

  function readJson<T>(key: string, fallback: T): T {
    try {
      const raw = storage?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  /** Applies changes saved by any window. */
  function sync() {
    const overrides = readJson<AssetOverrides>(ASSETS_KEY, {});
    for (const list of data.assets.values()) {
      for (const a of list) {
        const o = overrides[a.id];
        if (!o) continue;
        if ("rating" in o) {
          a.rating = o.rating ?? null;
          a.ratingSource = o.source ?? null;
        }
        if (o.imported !== undefined) a.imported = o.imported;
      }
    }
  }

  function saveAssets(assets: AssetView[]) {
    const overrides = readJson<AssetOverrides>(ASSETS_KEY, {});
    for (const a of assets) {
      overrides[a.id] = { rating: a.rating, source: a.ratingSource, imported: a.imported };
    }
    storage?.setItem(ASSETS_KEY, JSON.stringify(overrides));
  }

  function settings(): ImportSettings {
    return readJson<ImportSettings>(SETTINGS_KEY, structuredClone(DEFAULT_IMPORT_SETTINGS));
  }

  // Without storage, settings live in memory.
  let memorySettings = structuredClone(DEFAULT_IMPORT_SETTINGS);
  const getSettings = () => (storage ? settings() : memorySettings);

  function findAsset(id: string): AssetView | undefined {
    for (const list of data.assets.values()) {
      const found = list.find((a) => a.id === id);
      if (found) return found;
    }
    return undefined;
  }

  function report(progress: ImportProgress) {
    publish?.({ type: "importProgress", from: "backend", progress: { ...progress } });
  }

  async function runJob(current: { progress: ImportProgress; cancelled: boolean }, request: ImportRequest) {
    const plan = planImport(data.assets.get(request.deviceId) ?? [], getSettings(), request);
    const p = current.progress;
    const done = new Set<string>();
    for (const item of plan.files) {
      if (current.cancelled) break;
      p.currentFile = item.file.name;
      report(p);
      await sleep(copyDelayMs.perFile + ((item.file.size ?? 0) / (1024 * 1024)) * copyDelayMs.perMb);
      if (current.cancelled) break;
      p.filesDone += 1;
      p.bytesDone += item.file.size ?? 0;
      done.add(item.asset.id);
    }
    // Mark assets whose selected files were all copied as imported.
    const updated: AssetView[] = [];
    for (const id of done) {
      const asset = findAsset(id);
      if (asset && !asset.imported) {
        asset.imported = true;
        updated.push(structuredClone(asset));
      }
    }
    if (updated.length > 0) {
      saveAssets(updated);
      publish?.({ type: "assetsUpdated", from: "backend", assets: updated });
    }
    p.state = current.cancelled ? "cancelled" : "completed";
    p.currentFile = null;
    report(p);
  }

  async function handle(cmd: string, args: Record<string, unknown> = {}): Promise<unknown> {
    switch (cmd) {
      case "app_info":
        return { name: "seiton", version: "0.1.0 (mock)" } satisfies AppInfo;
      case "profile_warnings":
        return [];
      case "list_devices":
        await sleep(listDelayMs);
        return structuredClone(data.devices);
      case "list_assets": {
        await sleep(listDelayMs);
        sync();
        const list = data.assets.get(String(args.deviceId));
        if (!list) throw new Error(`unknown device: ${String(args.deviceId)}`);
        return structuredClone(list);
      }
      case "set_rating": {
        const update = args.update as RatingUpdate;
        if (update.rating !== null && (!Number.isInteger(update.rating) || update.rating < 0 || update.rating > 5)) {
          throw new Error(`invalid rating: ${update.rating}`);
        }
        sync();
        const updated: AssetView[] = [];
        for (const id of update.assetIds) {
          const asset = findAsset(id);
          if (!asset) throw new Error(`unknown asset: ${id}`);
          asset.rating = update.rating;
          asset.ratingSource = update.rating === null ? null : "app";
          updated.push(structuredClone(asset));
        }
        saveAssets(updated);
        publish?.({ type: "assetsUpdated", from: "backend", assets: updated });
        return updated;
      }
      case "get_thumbnail": {
        const asset = findAsset(String(args.assetId));
        if (!asset) throw new Error(`unknown asset: ${String(args.assetId)}`);
        const [lo, hi] = thumbDelayMs;
        await sleep(lo + Math.random() * (hi - lo));
        return placeholderThumbnail(asset);
      }
      case "get_import_settings":
        return getSettings();
      case "set_import_settings": {
        const next = structuredClone(args.settings as ImportSettings);
        if (next.formats.perRating.length !== 6) throw new Error("perRating must have 6 entries");
        if (storage) storage.setItem(SETTINGS_KEY, JSON.stringify(next));
        else memorySettings = next;
        publish?.({ type: "importSettingsUpdated", from: "backend", settings: next });
        return next;
      }
      case "start_import": {
        if (job?.progress.state === "running") throw new Error(MESSAGES.en.problem({ code: "running" }));
        const request = args.request as ImportRequest;
        sync();
        const plan = planImport(data.assets.get(request.deviceId) ?? [], getSettings(), request);
        if (plan.problems.length > 0) throw new Error(plan.problems.map((p) => MESSAGES.en.problem(p)).join("\n"));
        jobCounter += 1;
        const current = {
          cancelled: false,
          progress: {
            jobId: `job-${jobCounter}`,
            deviceId: request.deviceId,
            state: "running",
            filesDone: 0,
            filesTotal: plan.files.length,
            bytesDone: 0,
            bytesTotal: plan.bytes,
            currentFile: null,
            error: null,
          } satisfies ImportProgress as ImportProgress,
        };
        job = current;
        void runJob(current, request);
        return { ...current.progress };
      }
      case "cancel_import":
        if (job && job.progress.jobId === args.jobId) job.cancelled = true;
        return null;
      case "get_import_status":
        return job ? { ...job.progress } : null;
      default:
        throw new Error(`mock backend: unsupported command ${cmd}`);
    }
  }

  sync();
  return { data, handle };
}

/**
 * Serves seiton's commands from memory (used by `npm run dev:mock` and
 * `npm run tauri:mock`). Tauri's own APIs are not mocked.
 */
export function installMockBackend(options?: MockOptions): MockData {
  const backend = createMockHandler(options);
  setBackendOverride(backend.handle);
  return backend.data;
}
