import { invoke } from "@tauri-apps/api/core";
import type { AssetView } from "./bindings/AssetView";
import type { DeviceView } from "./bindings/DeviceView";
import type { FolderScan } from "./bindings/FolderScan";
import type { RatingUpdate } from "./bindings/RatingUpdate";

// Types generated from Rust (src-tauri/src/dto.rs) by ts-rs.
export type { AssetView } from "./bindings/AssetView";
export type { DeviceView } from "./bindings/DeviceView";
export type { FileView } from "./bindings/FileView";
export type { FolderScan } from "./bindings/FolderScan";
export type { GroupView } from "./bindings/GroupView";
export type { MediaKind } from "./bindings/MediaKind";
export type { RatingSource } from "./bindings/RatingSource";
export type { RatingUpdate } from "./bindings/RatingUpdate";
export type { TransportView } from "./bindings/TransportView";

/** Mirrors `seiton_app::commands::AppInfo`. */
export interface AppInfo {
  name: string;
  version: string;
}

type Handler = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

let override: Handler | null = null;

/**
 * Routes app commands to `handler` instead of the Rust backend (mock mode).
 *
 * Only seiton's own commands go through here; Tauri APIs (windows, events,
 * dialogs) keep using the real runtime, so multi-window behaviour can be
 * exercised with mock data inside `tauri dev`. Pass `null` to restore.
 */
export function setBackendOverride(handler: Handler | null) {
  override = handler;
}

function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return override ? (override(cmd, args) as Promise<T>) : invoke<T>(cmd, args);
}

export function getAppInfo(): Promise<AppInfo> {
  return call<AppInfo>("app_info");
}

export function scanFolder(path: string): Promise<FolderScan> {
  return call<FolderScan>("scan_folder", { path });
}

// The commands below are served by the mock backend (`npm run dev:mock`)
// until the real implementations land (Tasks 4–7).

export function listDevices(): Promise<DeviceView[]> {
  return call<DeviceView[]>("list_devices");
}

export function listAssets(deviceId: string): Promise<AssetView[]> {
  return call<AssetView[]>("list_assets", { deviceId });
}

/** Returns the updated assets. The backend also broadcasts `assetsUpdated`. */
export function setRating(update: RatingUpdate): Promise<AssetView[]> {
  return call<AssetView[]>("set_rating", { update });
}

/** A thumbnail as an image URL (Task 7 replaces this with `thumb://`). */
export function getThumbnail(assetId: string): Promise<string> {
  return call<string>("get_thumbnail", { assetId });
}
