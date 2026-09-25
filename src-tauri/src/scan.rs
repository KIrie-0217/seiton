//! Folder (SD card) scanning exposed to the UI.

use std::path::Path;
use std::sync::Arc;

use seiton_device_api::DeviceSource;
use seiton_device_fs::FsSource;
use seiton_profiles::{CameraProfile, MediaGroup, Probe, resolve, scan};

pub use crate::dto::{FileView, FolderScan, GroupView};

impl From<MediaGroup> for GroupView {
    fn from(g: MediaGroup) -> Self {
        Self {
            key: g.key.0,
            name: g.name,
            files: g
                .files
                .into_iter()
                .map(|f| FileView {
                    name: f.entry.path.file_name().unwrap_or_default().to_owned(),
                    path: f.entry.path.as_str().to_owned(),
                    kind: f.kind,
                    size: f.entry.size,
                })
                .collect(),
        }
    }
}

/// Opens `root` as a mass-storage device, picks a profile and lists its media.
///
/// Only reads directory listings; nothing on the card is modified.
pub fn scan_folder(root: &Path, profiles: &[Arc<dyn CameraProfile>]) -> Result<FolderScan, String> {
    let src = FsSource::open(root).map_err(|e| e.to_string())?;
    let probe = Probe::collect(&src).map_err(|e| e.to_string())?;
    let profile = resolve(profiles, src.info(), &probe)
        .ok_or_else(|| "no camera profile is available".to_owned())?;
    let groups = scan(&src, profile.as_ref()).map_err(|e| e.to_string())?;
    Ok(FolderScan {
        source_label: src.info().label.clone(),
        profile_id: profile.id().to_owned(),
        profile_name: profile.name().to_owned(),
        groups: groups.into_iter().map(GroupView::from).collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use seiton_core::MediaKind;
    use seiton_profiles::ProfileRegistry;
    use std::fs;

    #[test]
    fn scans_a_canon_card_folder() {
        let card = tempfile::tempdir().unwrap();
        let dir = card.path().join("DCIM").join("100CANON");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("IMG_0001.CR3"), b"raw").unwrap();
        fs::write(dir.join("IMG_0001.JPG"), b"jpeg!").unwrap();

        let profiles = ProfileRegistry::builtin().unwrap().build().profiles;
        let result = scan_folder(card.path(), &profiles).unwrap();

        assert_eq!(result.profile_id, "canon");
        assert_eq!(result.groups.len(), 1);
        let g = &result.groups[0];
        assert_eq!(g.name, "IMG_0001");
        assert_eq!(g.files[0].kind, MediaKind::Raw);
        assert_eq!(g.files[1].name, "IMG_0001.JPG");
        assert_eq!(g.files[1].size, Some(5));

        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["profileId"], "canon");
        assert_eq!(json["groups"][0]["files"][0]["kind"], "raw");
    }

    #[test]
    fn reports_missing_folder() {
        let profiles = ProfileRegistry::builtin().unwrap().build().profiles;
        let err = scan_folder(Path::new("/definitely/not/here"), &profiles).unwrap_err();
        assert!(err.contains("not found"), "{err}");
    }
}
