import { invoke, isTauri } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { AssetView } from "./bindings/AssetView";
import type { DeviceView } from "./bindings/DeviceView";
import type { FolderScan } from "./bindings/FolderScan";
import type { ImportProgress } from "./bindings/ImportProgress";
import type { ImportRequest } from "./bindings/ImportRequest";
import type { ImportSettings } from "./bindings/ImportSettings";
import type { RatingUpdate } from "./bindings/RatingUpdate";

// Types generated from Rust (src-tauri/src/dto.rs) by ts-rs.
export type { AssetView } from "./bindings/AssetView";
export type { DeviceView } from "./bindings/DeviceView";
export type { FileView } from "./bindings/FileView";
export type { FolderMode } from "./bindings/FolderMode";
export type { FolderScan } from "./bindings/FolderScan";
export type { FolderSettings } from "./bindings/FolderSettings";
export type { FormatMode } from "./bindings/FormatMode";
export type { FormatSettings } from "./bindings/FormatSettings";
export type { GroupView } from "./bindings/GroupView";
export type { ImportProgress } from "./bindings/ImportProgress";
export type { ImportRequest } from "./bindings/ImportRequest";
export type { ImportSettings } from "./bindings/ImportSettings";
export type { ImportState } from "./bindings/ImportState";
export type { MediaCategory } from "./bindings/MediaCategory";
export type { MediaKind } from "./bindings/MediaKind";
export type { RatingSource } from "./bindings/RatingSource";
export type { RatingUpdate } from "./bindings/RatingUpdate";
export type { SaveFormats } from "./bindings/SaveFormats";
export type { SimpleFolders } from "./bindings/SimpleFolders";
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

// ---- import (mock until Tasks 9–10) ----

export function getImportSettings(): Promise<ImportSettings> {
  return call<ImportSettings>("get_import_settings");
}

/** Saves settings; the backend broadcasts `importSettingsUpdated`. */
export function setImportSettings(settings: ImportSettings): Promise<ImportSettings> {
  return call<ImportSettings>("set_import_settings", { settings });
}

/** Starts a job; progress is broadcast as `importProgress`. */
export function startImport(request: ImportRequest): Promise<ImportProgress> {
  return call<ImportProgress>("start_import", { request });
}

export function cancelImport(jobId: string): Promise<void> {
  return call<void>("cancel_import", { jobId });
}

/** The current or last import job, if any. */
export function getImportStatus(): Promise<ImportProgress | null> {
  return call<ImportProgress | null>("get_import_status");
}

/** Opens the OS folder picker. Only available inside the Tauri app. */
export async function pickDirectory(title: string): Promise<string | null> {
  if (!isTauri()) return null;
  const picked = await openDialog({ directory: true, multiple: false, title });
  return typeof picked === "string" ? picked : null;
}

export function canPickDirectory(): boolean {
  return isTauri();
}
