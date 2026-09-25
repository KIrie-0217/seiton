//! Tauri shell: wires providers together and exposes commands to the UI.

pub mod commands;
pub mod dto;
pub mod scan;
mod state;

use tauri::Manager;

pub use state::AppState;

/// Builds and runs the Tauri application.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // User profiles live in `<app config dir>/profiles/*.toml`.
            let user_dir = app.path().app_config_dir().ok().map(|d| d.join("profiles"));
            let state = AppState::load(user_dir.as_deref());
            for w in &state.profile_warnings {
                eprintln!("profile warning: {w}");
            }
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::scan_folder,
            commands::profile_warnings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running seiton");
}
