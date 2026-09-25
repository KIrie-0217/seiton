//! The [`CameraProfile`] trait and its TOML-backed implementation.

use std::collections::HashMap;

use globset::{Glob, GlobBuilder, GlobMatcher, GlobSet, GlobSetBuilder};
use seiton_core::MediaKind;
use seiton_device_api::{DeviceInfo, DeviceSource, Entry, Result, SourceError, VPath, walk};

use crate::def::{ProfileDef, ProfileError, ProfileOrigin};

/// Key that groups the files of one shot (e.g. `IMG_0001.CR3` + `IMG_0001.JPG`).
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct GroupKey(pub String);

/// Facts gathered from a device to pick a profile.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Probe {
    /// Directories within two levels of the root (e.g. `DCIM`, `DCIM/100CANON`).
    pub dirs: Vec<VPath>,
    /// EXIF `Make` of a sample file, when already known.
    pub exif_make: Option<String>,
}

impl Probe {
    /// Lists directories near the root of `src`.
    pub fn collect(src: &dyn DeviceSource) -> Result<Self> {
        let dirs = walk(src, &VPath::root(), 2)?
            .into_iter()
            .filter(Entry::is_dir)
            .map(|e| e.path)
            .collect();
        Ok(Self {
            dirs,
            exif_make: None,
        })
    }
}

/// A directory pattern whose contents are scanned for media.
#[derive(Debug, Clone)]
pub struct ScanRoot {
    pattern: String,
    base: VPath,
    matcher: GlobMatcher,
}

impl ScanRoot {
    fn new(pattern: &str) -> std::result::Result<Self, String> {
        let normalized = VPath::parse(pattern).map_err(|e| e.to_string())?;
        if normalized.is_root() {
            return Err("scan root must not be the device root".to_owned());
        }
        let base_parts: Vec<&str> = normalized
            .components()
            .take_while(|c| !c.contains(['*', '?', '[', '{']))
            .collect();
        let base = VPath::parse(&base_parts.join("/")).map_err(|e| e.to_string())?;
        Ok(Self {
            pattern: normalized.as_str().to_owned(),
            base,
            matcher: glob(normalized.as_str())?.compile_matcher(),
        })
    }

    /// The glob as written (normalized).
    pub fn pattern(&self) -> &str {
        &self.pattern
    }

    /// The longest literal prefix; scanning starts here.
    pub fn base(&self) -> &VPath {
        &self.base
    }

    /// Whether `dir` is a media directory for this root.
    pub fn matches(&self, dir: &VPath) -> bool {
        self.matcher.is_match(dir.as_str())
    }
}

/// Describes how to recognize a camera and interpret its files.
///
/// Most profiles are data ([`TomlProfile`]); code-based implementations can
/// be added for layouts that TOML cannot express.
pub trait CameraProfile: Send + Sync {
    fn id(&self) -> &str;

    fn name(&self) -> &str;

    /// How well this profile fits the device; 0 means "does not apply".
    fn score(&self, dev: &DeviceInfo, probe: &Probe) -> u8;

    fn scan_roots(&self) -> &[ScanRoot];

    fn is_ignored(&self, path: &VPath) -> bool;

    fn classify(&self, entry: &Entry) -> Option<MediaKind>;

    fn group_key(&self, entry: &Entry) -> GroupKey;

    /// ExifTool tags to read the rating from, in priority order.
    fn rating_tags(&self) -> &[String];
}

/// A validated profile built from a (merged) [`ProfileDef`].
#[derive(Debug)]
pub struct TomlProfile {
    id: String,
    name: String,
    origin: ProfileOrigin,
    fallback: bool,
    usb_vendor_ids: Vec<u16>,
    exif_make: Vec<String>,
    folder_signature: GlobSet,
    scan_roots: Vec<ScanRoot>,
    ignore: GlobSet,
    kinds: HashMap<String, MediaKind>,
    rating_tags: Vec<String>,
}

fn glob(pattern: &str) -> std::result::Result<Glob, String> {
    GlobBuilder::new(pattern)
        .case_insensitive(true)
        .literal_separator(true)
        .build()
        .map_err(|e| format!("invalid glob `{pattern}`: {e}"))
}

fn glob_set(patterns: &[String]) -> std::result::Result<GlobSet, String> {
    let mut builder = GlobSetBuilder::new();
    for p in patterns {
        let normalized = VPath::parse(p).map_err(|e| format!("invalid glob `{p}`: {e}"))?;
        builder.add(glob(normalized.as_str())?);
    }
    builder.build().map_err(|e| e.to_string())
}

fn is_valid_id(id: &str) -> bool {
    let mut chars = id.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_lowercase() || c.is_ascii_digit())
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

impl TomlProfile {
    /// Validates a merged definition.
    pub fn compile(
        def: &ProfileDef,
        origin: ProfileOrigin,
    ) -> std::result::Result<Self, ProfileError> {
        let invalid = |reason: String| ProfileError::Invalid {
            origin: origin.clone(),
            id: def.id.clone(),
            reason,
        };
        if !is_valid_id(&def.id) {
            return Err(invalid("id must match [a-z0-9][a-z0-9-]*".to_owned()));
        }

        let m = &def.matching;
        let usb_vendor_ids = m.usb_vendor_id.clone().unwrap_or_default();
        let exif_make: Vec<String> = m
            .exif_make
            .clone()
            .unwrap_or_default()
            .into_iter()
            .map(|s| s.trim().to_ascii_lowercase())
            .collect();
        if exif_make.iter().any(String::is_empty) {
            return Err(invalid("exif_make entries must not be empty".to_owned()));
        }
        let signatures = m.folder_signature.clone().unwrap_or_default();
        if !m.fallback && usb_vendor_ids.is_empty() && exif_make.is_empty() && signatures.is_empty()
        {
            return Err(invalid(
                "a non-fallback profile needs usb_vendor_id, exif_make or folder_signature"
                    .to_owned(),
            ));
        }
        let folder_signature = glob_set(&signatures).map_err(invalid)?;

        let roots = def.layout.scan_roots.clone().unwrap_or_default();
        if roots.is_empty() {
            return Err(invalid("layout.scan_roots must not be empty".to_owned()));
        }
        let scan_roots = roots
            .iter()
            .map(|r| ScanRoot::new(r))
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(invalid)?;
        let ignore = glob_set(&def.layout.ignore.clone().unwrap_or_default()).map_err(invalid)?;

        let k = &def.kinds;
        let mut kinds = HashMap::new();
        for (kind, exts) in [
            (MediaKind::Raw, &k.raw),
            (MediaKind::Heif, &k.heif),
            (MediaKind::Jpeg, &k.jpeg),
            (MediaKind::Video, &k.video),
            (MediaKind::Sidecar, &k.sidecar),
        ] {
            for ext in exts.iter().flatten() {
                let upper = ext.trim().trim_start_matches('.').to_ascii_uppercase();
                if upper.is_empty() || !upper.chars().all(|c| c.is_ascii_alphanumeric()) {
                    return Err(invalid(format!("invalid extension `{ext}`")));
                }
                if let Some(prev) = kinds.insert(upper.clone(), kind)
                    && prev != kind
                {
                    return Err(invalid(format!(
                        "extension `{upper}` is listed as both {} and {}",
                        prev.as_str(),
                        kind.as_str()
                    )));
                }
            }
        }
        if kinds.is_empty() {
            return Err(invalid("no file kinds are defined".to_owned()));
        }

        let rating_tags = def.metadata.rating_tags.clone().unwrap_or_default();
        if rating_tags.iter().any(|t| t.trim().is_empty()) {
            return Err(invalid("rating_tags entries must not be empty".to_owned()));
        }

        Ok(Self {
            id: def.id.clone(),
            name: def.name.clone().unwrap_or_else(|| def.id.clone()),
            origin,
            fallback: m.fallback,
            usb_vendor_ids,
            exif_make,
            folder_signature,
            scan_roots,
            ignore,
            kinds,
            rating_tags,
        })
    }

    pub fn origin(&self) -> &ProfileOrigin {
        &self.origin
    }

    pub fn is_fallback(&self) -> bool {
        self.fallback
    }
}

impl CameraProfile for TomlProfile {
    fn id(&self) -> &str {
        &self.id
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn score(&self, dev: &DeviceInfo, probe: &Probe) -> u8 {
        if self.fallback {
            return 1;
        }
        let mut score: u16 = 0;
        if dev
            .usb_vendor_id
            .is_some_and(|vid| self.usb_vendor_ids.contains(&vid))
        {
            score += 100;
        }
        let make = probe.exif_make.as_deref().or(dev.manufacturer.as_deref());
        if let Some(make) = make.map(|m| m.trim().to_ascii_lowercase())
            && self.exif_make.iter().any(|p| make.starts_with(p.as_str()))
        {
            score += 80;
        }
        if probe
            .dirs
            .iter()
            .any(|d| self.folder_signature.is_match(d.as_str()))
        {
            score += 50;
        }
        u8::try_from(score).unwrap_or(u8::MAX)
    }

    fn scan_roots(&self) -> &[ScanRoot] {
        &self.scan_roots
    }

    fn is_ignored(&self, path: &VPath) -> bool {
        self.ignore.is_match(path.as_str())
            || path.ancestors().any(|a| self.ignore.is_match(a.as_str()))
    }

    fn classify(&self, entry: &Entry) -> Option<MediaKind> {
        if !entry.is_file() {
            return None;
        }
        let ext = entry.path.extension()?.to_ascii_uppercase();
        self.kinds.get(&ext).copied()
    }

    fn group_key(&self, entry: &Entry) -> GroupKey {
        let parent = entry.path.parent().unwrap_or_default();
        let stem = entry
            .path
            .file_stem()
            .unwrap_or_default()
            .to_ascii_uppercase();
        GroupKey(if parent.is_root() {
            stem
        } else {
            format!("{}/{stem}", parent.as_str())
        })
    }

    fn rating_tags(&self) -> &[String] {
        &self.rating_tags
    }
}

/// Maps a "not found" style error to `None` so missing scan roots are skipped.
pub(crate) fn missing_ok<T>(r: Result<T>) -> Result<Option<T>> {
    match r {
        Ok(v) => Ok(Some(v)),
        Err(SourceError::NotFound(_) | SourceError::NotADirectory(_)) => Ok(None),
        Err(e) => Err(e),
    }
}
