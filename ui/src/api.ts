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

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
}

export function scanFolder(path: string): Promise<FolderScan> {
  return invoke<FolderScan>("scan_folder", { path });
}

// The commands below are served by the mock backend (`npm run dev:mock`)
// until the real implementations land (Tasks 4–7).

export function listDevices(): Promise<DeviceView[]> {
  return invoke<DeviceView[]>("list_devices");
}

export function listAssets(deviceId: string): Promise<AssetView[]> {
  return invoke<AssetView[]>("list_assets", { deviceId });
}

/** Returns the updated assets. */
export function setRating(update: RatingUpdate): Promise<AssetView[]> {
  return invoke<AssetView[]>("set_rating", { update });
}

/** A thumbnail as an image URL (Task 7 replaces this with `thumb://`). */
export function getThumbnail(assetId: string): Promise<string> {
  return invoke<string>("get_thumbnail", { assetId });
}
