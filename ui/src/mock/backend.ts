import type { AppInfo, AssetView, RatingUpdate } from "../api";
import { setBackendOverride } from "../api";
import type { BusMessage } from "../windowing/bus";
import { createMockData, placeholderThumbnail, type MockData } from "./data";

export interface MockOptions {
  /** Simulated latency of list commands, in ms. */
  listDelayMs?: number;
  /** Simulated latency range of thumbnail loads, in ms. */
  thumbDelayMs?: [number, number];
  /** Where `assetsUpdated` is published, like the Rust backend will. */
  publish?: (msg: BusMessage) => void;
  /**
   * Persists ratings so that every window's mock backend (each window has
   * its own JS context) sees the same values. Defaults to localStorage.
   */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
}

const RATINGS_KEY = "seiton.mock.ratings";

type RatingOverrides = Record<string, { rating: number | null; source: AssetView["ratingSource"] }>;

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
  const { listDelayMs = 300, thumbDelayMs = [150, 600], publish } = options;
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const data = createMockData();

  function readOverrides(): RatingOverrides {
    try {
      return JSON.parse(storage?.getItem(RATINGS_KEY) ?? "{}") as RatingOverrides;
    } catch {
      return {};
    }
  }

  /** Applies ratings saved by any window. */
  function sync() {
    const overrides = readOverrides();
    for (const list of data.assets.values()) {
      for (const a of list) {
        const o = overrides[a.id];
        if (o) {
          a.rating = o.rating;
          a.ratingSource = o.source;
        }
      }
    }
  }

  function findAsset(id: string): AssetView | undefined {
    for (const list of data.assets.values()) {
      const found = list.find((a) => a.id === id);
      if (found) return found;
    }
    return undefined;
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
        const overrides = readOverrides();
        const updated: AssetView[] = [];
        for (const id of update.assetIds) {
          const asset = findAsset(id);
          if (!asset) throw new Error(`unknown asset: ${id}`);
          asset.rating = update.rating;
          asset.ratingSource = update.rating === null ? null : "app";
          overrides[id] = { rating: asset.rating, source: asset.ratingSource };
          updated.push(structuredClone(asset));
        }
        storage?.setItem(RATINGS_KEY, JSON.stringify(overrides));
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
