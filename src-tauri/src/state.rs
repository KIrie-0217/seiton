//! Shared application state.

use std::path::Path;
use std::sync::Arc;

use seiton_profiles::{CameraProfile, ProfileRegistry};

/// State managed by Tauri and shared by commands.
pub struct AppState {
    pub profiles: Vec<Arc<dyn CameraProfile>>,
    /// Human readable problems found while loading profiles.
    pub profile_warnings: Vec<String>,
}

impl AppState {
    /// Loads bundled profiles, then user profiles from `user_dir` if given.
    pub fn load(user_dir: Option<&Path>) -> Self {
        let mut warnings = Vec::new();
        let mut registry = match ProfileRegistry::builtin() {
            Ok(r) => r,
            Err(e) => {
                // Bundled profiles are covered by tests; keep running without them.
                warnings.push(e.to_string());
                ProfileRegistry::default()
            }
        };
        if let Some(dir) = user_dir {
            warnings.extend(registry.load_user_dir(dir).iter().map(ToString::to_string));
        }
        let built = registry.build();
        warnings.extend(built.warnings.iter().map(ToString::to_string));
        Self {
            profiles: built.profiles,
            profile_warnings: warnings,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_builtin_and_user_profiles() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("broken.toml"), "schema_version = 1\nid = ").unwrap();
        let state = AppState::load(Some(dir.path()));
        let ids: Vec<_> = state.profiles.iter().map(|p| p.id()).collect();
        assert_eq!(ids, ["canon", "generic-dcf"]);
        assert_eq!(state.profile_warnings.len(), 1);
        assert!(state.profile_warnings[0].contains("broken.toml"));
    }
}
