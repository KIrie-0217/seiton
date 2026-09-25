import { mockIPC } from "@tauri-apps/api/mocks";
import type { AppInfo, AssetView, RatingUpdate } from "../api";
import { createMockData, placeholderThumbnail, type MockData } from "./data";

export interface MockOptions {
  /** Simulated latency of list commands, in ms. */
  listDelayMs?: number;
  /** Simulated latency range of thumbnail loads, in ms. */
  thumbDelayMs?: [number, number];
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function findAsset(data: MockData, id: string): AssetView | undefined {
  for (const list of data.assets.values()) {
    const found = list.find((a) => a.id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Handles IPC commands against in-memory data. Exposed separately from
 * {@link installMockBackend} so tests can drive it directly.
 */
export function createMockHandler(options: MockOptions = {}) {
  const { listDelayMs = 300, thumbDelayMs = [150, 600] } = options;
  const data = createMockData();

  async function handle(cmd: string, args: Record<string, unknown> = {}): Promise<unknown> {
    switch (cmd) {
      case "app_info":
        return { name: "seiton", version: "0.1.0 (mock)" } satisfies AppInfo;
      case "profile_warnings":
        return [];
      case "list_devices":
        await sleep(listDelayMs);
        return data.devices;
      case "list_assets": {
        await sleep(listDelayMs);
        const list = data.assets.get(String(args.deviceId));
        if (!list) throw new Error(`unknown device: ${String(args.deviceId)}`);
        return list;
      }
      case "set_rating": {
        const update = args.update as RatingUpdate;
        if (update.rating !== null && (!Number.isInteger(update.rating) || update.rating < 0 || update.rating > 5)) {
          throw new Error(`invalid rating: ${update.rating}`);
        }
        const updated: AssetView[] = [];
        for (const id of update.assetIds) {
          const asset = findAsset(data, id);
          if (!asset) throw new Error(`unknown asset: ${id}`);
          asset.rating = update.rating;
          asset.ratingSource = update.rating === null ? null : "app";
          updated.push({ ...asset });
        }
        return updated;
      }
      case "get_thumbnail": {
        const asset = findAsset(data, String(args.assetId));
        if (!asset) throw new Error(`unknown asset: ${String(args.assetId)}`);
        const [lo, hi] = thumbDelayMs;
        await sleep(lo + Math.random() * (hi - lo));
        return placeholderThumbnail(asset);
      }
      default:
        throw new Error(`mock backend: unsupported command ${cmd}`);
    }
  }

  return { data, handle };
}

/** Routes every `invoke` to the mock backend (used by `npm run dev:mock`). */
export function installMockBackend(options?: MockOptions) {
  const backend = createMockHandler(options);
  mockIPC((cmd, args) => backend.handle(cmd, args as Record<string, unknown>));
  return backend;
}
