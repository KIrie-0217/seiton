import { invoke } from "@tauri-apps/api/core";

/** Mirrors `seiton_app::commands::AppInfo`. */
export interface AppInfo {
  name: string;
  version: string;
}

export type MediaKind = "raw" | "heif" | "jpeg" | "video" | "sidecar";

/** Mirrors `seiton_app::scan::FileView`. */
export interface FileView {
  name: string;
  path: string;
  kind: MediaKind;
  size: number | null;
}

/** Mirrors `seiton_app::scan::GroupView`. */
export interface GroupView {
  key: string;
  name: string;
  files: FileView[];
}

/** Mirrors `seiton_app::scan::FolderScan`. */
export interface FolderScan {
  sourceLabel: string;
  profileId: string;
  profileName: string;
  groups: GroupView[];
}

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
}

export function scanFolder(path: string): Promise<FolderScan> {
  return invoke<FolderScan>("scan_folder", { path });
}
