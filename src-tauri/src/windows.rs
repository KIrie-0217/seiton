//! Window labels shared with the UI (`ui/src/windowing/host.ts`) and the
//! capability file (`capabilities/default.json`).

/// Label of the main window (Tauri's default for the first window).
pub const MAIN: &str = "main";

/// Prefix of pane windows opened from the UI.
pub const PANE_PREFIX: &str = "pane-";

/// Whether a window with this label is a pane window.
pub fn is_pane(label: &str) -> bool {
    label.len() > PANE_PREFIX.len() && label.starts_with(PANE_PREFIX)
}

/// Closing this window closes the whole app (and its pane windows).
pub fn closes_app(label: &str) -> bool {
    label == MAIN
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_labels() {
        assert!(closes_app("main"));
        assert!(!closes_app("pane-abc-1"));
        assert!(is_pane("pane-abc-1"));
        assert!(!is_pane("pane-"));
        assert!(!is_pane("main"));
    }

    #[test]
    fn capability_covers_main_and_pane_windows() {
        let cap: serde_json::Value =
            serde_json::from_str(include_str!("../capabilities/default.json")).unwrap();
        let windows: Vec<&str> = cap["windows"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|w| w.as_str())
            .collect();
        assert!(windows.contains(&MAIN));
        assert!(windows.contains(&format!("{PANE_PREFIX}*").as_str()));
        let perms = cap["permissions"].to_string();
        assert!(perms.contains("core:webview:allow-create-webview-window"));
    }
}
