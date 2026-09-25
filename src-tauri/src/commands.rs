//! Tauri commands exposed to the frontend.

use serde::Serialize;

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
