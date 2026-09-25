//! Scanning a device into asset groups (RAW + JPEG pairs and so on).

use std::collections::{BTreeMap, HashSet};

use seiton_core::MediaKind;
use seiton_device_api::{DeviceSource, Entry, Result, walk};

use crate::profile::{CameraProfile, GroupKey, missing_ok};

/// How deep to descend below a scan root's literal base.
const SCAN_DEPTH: usize = 4;

/// A classified file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MediaFile {
    pub entry: Entry,
    pub kind: MediaKind,
}

/// Files that belong to one shot, ordered RAW, HEIF, JPEG, video, sidecar.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MediaGroup {
    pub key: GroupKey,
    /// Display name: the file stem as found on the device.
    pub name: String,
    pub files: Vec<MediaFile>,
}

impl MediaGroup {
    pub fn kinds(&self) -> impl Iterator<Item = MediaKind> + '_ {
        self.files.iter().map(|f| f.kind)
    }
}

/// Lists the media on `src` according to `profile`, grouped and sorted by key.
///
/// Scan roots that do not exist on the device are skipped.
pub fn scan(src: &dyn DeviceSource, profile: &dyn CameraProfile) -> Result<Vec<MediaGroup>> {
    let mut groups: BTreeMap<GroupKey, Vec<MediaFile>> = BTreeMap::new();
    let mut seen = HashSet::new();
    for root in profile.scan_roots() {
        let Some(entries) = missing_ok(walk(src, root.base(), SCAN_DEPTH))? else {
            continue;
        };
        for entry in entries {
            if !entry.is_file()
                || !entry.path.ancestors().any(|a| root.matches(&a))
                || profile.is_ignored(&entry.path)
            {
                continue;
            }
            let Some(kind) = profile.classify(&entry) else {
                continue;
            };
            if !seen.insert(entry.obj.clone()) {
                continue;
            }
            groups
                .entry(profile.group_key(&entry))
                .or_default()
                .push(MediaFile { entry, kind });
        }
    }
    Ok(groups
        .into_iter()
        .map(|(key, mut files)| {
            files.sort_by(|a, b| {
                (a.kind.rank(), &a.entry.path).cmp(&(b.kind.rank(), &b.entry.path))
            });
            let name = files
                .first()
                .and_then(|f| f.entry.path.file_stem())
                .unwrap_or_default()
                .to_owned();
            MediaGroup { key, name, files }
        })
        .collect())
}
