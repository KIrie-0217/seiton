import { invoke } from "@tauri-apps/api/core";

/** Mirrors `seiton_app::commands::AppInfo`. */
export interface AppInfo {
  name: string;
  version: string;
}

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
}
