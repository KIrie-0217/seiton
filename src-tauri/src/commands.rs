//! Tauri commands exposed to the frontend.

use serde::Serialize;

use crate::AppState;
use crate::scan::FolderScan;

/// Basic application information shown in the UI.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

impl AppInfo {
    /// Information about the running build.
    pub fn current() -> Self {
        Self {
            name: "seiton".to_owned(),
            version: env!("CARGO_PKG_VERSION").to_owned(),
        }
    }
}

/// Returns the application name and version.
#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo::current()
}

/// Scans a local folder (e.g. an SD card) and groups its media.
///
/// Runs on a blocking thread so large cards do not freeze the UI.
#[tauri::command]
pub async fn scan_folder(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<FolderScan, String> {
    let profiles = state.profiles.clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::scan::scan_folder(std::path::Path::new(&path), &profiles)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Problems found while loading camera profiles.
#[tauri::command]
pub fn profile_warnings(state: tauri::State<'_, AppState>) -> Vec<String> {
    state.profile_warnings.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_reports_package_version() {
        let info = app_info();
        assert_eq!(info.name, "seiton");
        assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn app_info_serializes_with_expected_field_names() {
        let json = serde_json::to_value(AppInfo::current()).unwrap();
        assert_eq!(json["name"], "seiton");
        assert!(json["version"].is_string());
    }
}
