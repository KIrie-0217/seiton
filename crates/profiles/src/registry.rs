//! Profile registry: bundled + user profiles, inheritance and resolution.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::sync::Arc;

use seiton_device_api::DeviceInfo;

use crate::def::{ProfileDef, ProfileError, ProfileOrigin};
use crate::profile::{CameraProfile, Probe, TomlProfile};

const BUILTIN: &[(&str, &str)] = &[
    (
        "generic-dcf.toml",
        include_str!("../../../profiles/generic-dcf.toml"),
    ),
    ("canon.toml", include_str!("../../../profiles/canon.toml")),
];

/// Maximum `extends` depth, as a guard against pathological chains.
const MAX_DEPTH: usize = 8;

/// Collects profile definitions in layers: later layers (user files)
/// override earlier ones (bundled) with the same `id`.
#[derive(Debug, Default)]
pub struct ProfileRegistry {
    layers: BTreeMap<String, Vec<(ProfileDef, ProfileOrigin)>>,
}

/// Result of [`ProfileRegistry::build`].
#[derive(Default)]
pub struct BuiltProfiles {
    /// Specific profiles first (by id), fallback profiles last.
    pub profiles: Vec<Arc<dyn CameraProfile>>,
    /// Problems with individual definitions. A broken user override falls
    /// back to the bundled definition with the same id when there is one.
    pub warnings: Vec<ProfileError>,
}

impl ProfileRegistry {
    /// A registry containing the bundled profiles.
    pub fn builtin() -> Result<Self, ProfileError> {
        let mut reg = Self::default();
        for (name, text) in BUILTIN {
            reg.add_toml(text, ProfileOrigin::Builtin(name))?;
        }
        Ok(reg)
    }

    /// Adds a definition on top of any existing one with the same id.
    pub fn add_toml(&mut self, text: &str, origin: ProfileOrigin) -> Result<(), ProfileError> {
        let def = ProfileDef::parse(text, &origin)?;
        self.layers
            .entry(def.id.clone())
            .or_default()
            .push((def, origin));
        Ok(())
    }

    /// Loads every `*.toml` in `dir` (non-recursive, in name order).
    ///
    /// A missing directory is not an error. Files that fail to load are
    /// reported and skipped.
    pub fn load_user_dir(&mut self, dir: &Path) -> Vec<ProfileError> {
        let io_err = |source| ProfileError::Io {
            path: dir.to_path_buf(),
            source,
        };
        let read = match fs::read_dir(dir) {
            Ok(r) => r,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Vec::new(),
            Err(e) => return vec![io_err(e)],
        };
        let mut paths: Vec<_> = read
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| {
                p.is_file()
                    && p.extension()
                        .is_some_and(|e| e.eq_ignore_ascii_case("toml"))
            })
            .collect();
        paths.sort();

        let mut errors = Vec::new();
        for path in paths {
            let result = fs::read_to_string(&path)
                .map_err(|source| ProfileError::Io {
                    path: path.clone(),
                    source,
                })
                .and_then(|text| self.add_toml(&text, ProfileOrigin::User(path.clone())));
            if let Err(e) = result {
                errors.push(e);
            }
        }
        errors
    }

    /// Resolves inheritance and validates every profile.
    pub fn build(&self) -> BuiltProfiles {
        let mut out = BuiltProfiles::default();
        let mut compiled: Vec<TomlProfile> = Vec::new();
        for id in self.layers.keys() {
            let mut stack = Vec::new();
            if let Some((def, origin)) = self.effective(id, &mut stack, &mut out.warnings) {
                // `effective` only returns definitions that compile.
                if let Ok(p) = TomlProfile::compile(&def, origin) {
                    compiled.push(p);
                }
            }
        }
        compiled.sort_by(|a, b| (a.is_fallback(), a.id()).cmp(&(b.is_fallback(), b.id())));
        out.profiles = compiled
            .into_iter()
            .map(|p| Arc::new(p) as Arc<dyn CameraProfile>)
            .collect();
        out
    }

    /// The merged definition for `id`, trying layers from the top.
    fn effective(
        &self,
        id: &str,
        stack: &mut Vec<String>,
        warnings: &mut Vec<ProfileError>,
    ) -> Option<(ProfileDef, ProfileOrigin)> {
        if stack.iter().any(|s| s == id) || stack.len() >= MAX_DEPTH {
            let mut chain = stack.clone();
            chain.push(id.to_owned());
            warnings.push(ProfileError::Cycle {
                chain: chain.join(" -> "),
            });
            return None;
        }
        let layers = self.layers.get(id)?;
        for (def, origin) in layers.iter().rev() {
            let merged = match &def.extends {
                None => def.clone(),
                Some(parent) => {
                    if !self.layers.contains_key(parent) {
                        warnings.push(ProfileError::UnknownParent {
                            id: id.to_owned(),
                            parent: parent.clone(),
                        });
                        continue;
                    }
                    stack.push(id.to_owned());
                    let parent_def = self.effective(parent, stack, warnings);
                    stack.pop();
                    match parent_def {
                        Some((p, _)) => def.overlay_on(&p),
                        None => continue,
                    }
                }
            };
            match TomlProfile::compile(&merged, origin.clone()) {
                Ok(_) => return Some((merged, origin.clone())),
                Err(e) => warnings.push(e),
            }
        }
        None
    }
}

/// Picks the best profile for a device (highest score, first on ties).
pub fn resolve<'a>(
    profiles: &'a [Arc<dyn CameraProfile>],
    dev: &DeviceInfo,
    probe: &Probe,
) -> Option<&'a Arc<dyn CameraProfile>> {
    let mut best: Option<(&Arc<dyn CameraProfile>, u8)> = None;
    for p in profiles {
        let score = p.score(dev, probe);
        if score > 0 && best.is_none_or(|(_, s)| score > s) {
            best = Some((p, score));
        }
    }
    best.map(|(p, _)| p)
}
