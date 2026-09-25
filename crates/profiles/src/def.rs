//! Serialized form of a profile (the TOML schema) and loading errors.

use std::fmt;
use std::path::PathBuf;

use serde::Deserialize;

/// The only `schema_version` this build understands.
pub const SCHEMA_VERSION: u32 = 1;

/// Where a profile definition came from.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProfileOrigin {
    /// Bundled with the application (file name).
    Builtin(&'static str),
    /// Loaded from the user's profile folder.
    User(PathBuf),
    /// Supplied programmatically (tests).
    Inline(String),
}

impl fmt::Display for ProfileOrigin {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Builtin(name) => write!(f, "builtin:{name}"),
            Self::User(path) => write!(f, "{}", path.display()),
            Self::Inline(name) => write!(f, "inline:{name}"),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ProfileError {
    #[error("{origin}: failed to parse TOML: {message}")]
    Parse {
        origin: ProfileOrigin,
        message: String,
    },
    #[error("{origin}: unsupported schema_version {found} (supported: {supported})")]
    UnsupportedSchema {
        origin: ProfileOrigin,
        found: u32,
        supported: u32,
    },
    #[error("{origin}: profile `{id}` is invalid: {reason}")]
    Invalid {
        origin: ProfileOrigin,
        id: String,
        reason: String,
    },
    #[error("profile `{id}` extends unknown profile `{parent}`")]
    UnknownParent { id: String, parent: String },
    #[error("profile inheritance cycle: {chain}")]
    Cycle { chain: String },
    #[error("{}: {source}", path.display())]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
}

/// A profile as written in TOML.
///
/// Every field except `schema_version`, `id`, `extends` and `match.fallback`
/// is optional and inherited from the `extends` parent when omitted. Lists
/// replace (not append to) the parent's list.
#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProfileDef {
    pub schema_version: u32,
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub extends: Option<String>,
    #[serde(default, rename = "match")]
    pub matching: MatchDef,
    #[serde(default)]
    pub layout: LayoutDef,
    #[serde(default)]
    pub kinds: KindsDef,
    #[serde(default)]
    pub metadata: MetadataDef,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MatchDef {
    /// Used when nothing else matches. Not inherited.
    #[serde(default)]
    pub fallback: bool,
    pub usb_vendor_id: Option<Vec<u16>>,
    /// Case-insensitive prefixes of EXIF `Make` / MTP manufacturer.
    pub exif_make: Option<Vec<String>>,
    /// Globs matched against directories near the root (e.g. `DCIM/*CANON`).
    pub folder_signature: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LayoutDef {
    /// Globs of directories whose contents are media (e.g. `DCIM/*`).
    pub scan_roots: Option<Vec<String>>,
    /// Globs of paths to skip.
    pub ignore: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KindsDef {
    pub raw: Option<Vec<String>>,
    pub heif: Option<Vec<String>>,
    pub jpeg: Option<Vec<String>>,
    pub video: Option<Vec<String>>,
    pub sidecar: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MetadataDef {
    /// ExifTool tags to read the rating from, in priority order.
    pub rating_tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct VersionProbe {
    schema_version: Option<u32>,
}

impl ProfileDef {
    /// Parses a TOML profile, checking `schema_version` before the rest so
    /// that files for newer schemas report a clear error.
    pub fn parse(text: &str, origin: &ProfileOrigin) -> Result<Self, ProfileError> {
        let parse_err = |e: toml::de::Error| ProfileError::Parse {
            origin: origin.clone(),
            message: e.to_string(),
        };
        let probe: VersionProbe = toml::from_str(text).map_err(parse_err)?;
        match probe.schema_version {
            Some(SCHEMA_VERSION) => {}
            Some(found) => {
                return Err(ProfileError::UnsupportedSchema {
                    origin: origin.clone(),
                    found,
                    supported: SCHEMA_VERSION,
                });
            }
            None => {
                return Err(ProfileError::Parse {
                    origin: origin.clone(),
                    message: "missing `schema_version`".to_owned(),
                });
            }
        }
        toml::from_str(text).map_err(parse_err)
    }

    /// Returns `self` with omitted fields filled from `parent`.
    pub(crate) fn overlay_on(&self, parent: &ProfileDef) -> ProfileDef {
        fn pick<T: Clone>(child: &Option<T>, parent: &Option<T>) -> Option<T> {
            child.clone().or_else(|| parent.clone())
        }
        ProfileDef {
            schema_version: self.schema_version,
            id: self.id.clone(),
            name: pick(&self.name, &parent.name),
            extends: self.extends.clone(),
            matching: MatchDef {
                fallback: self.matching.fallback,
                usb_vendor_id: pick(&self.matching.usb_vendor_id, &parent.matching.usb_vendor_id),
                exif_make: pick(&self.matching.exif_make, &parent.matching.exif_make),
                folder_signature: pick(
                    &self.matching.folder_signature,
                    &parent.matching.folder_signature,
                ),
            },
            layout: LayoutDef {
                scan_roots: pick(&self.layout.scan_roots, &parent.layout.scan_roots),
                ignore: pick(&self.layout.ignore, &parent.layout.ignore),
            },
            kinds: KindsDef {
                raw: pick(&self.kinds.raw, &parent.kinds.raw),
                heif: pick(&self.kinds.heif, &parent.kinds.heif),
                jpeg: pick(&self.kinds.jpeg, &parent.kinds.jpeg),
                video: pick(&self.kinds.video, &parent.kinds.video),
                sidecar: pick(&self.kinds.sidecar, &parent.kinds.sidecar),
            },
            metadata: MetadataDef {
                rating_tags: pick(&self.metadata.rating_tags, &parent.metadata.rating_tags),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn origin() -> ProfileOrigin {
        ProfileOrigin::Inline("test".into())
    }

    #[test]
    fn parses_minimal_profile() {
        let def = ProfileDef::parse("schema_version = 1\nid = \"x\"\n", &origin()).unwrap();
        assert_eq!(def.id, "x");
        assert_eq!(def.kinds, KindsDef::default());
        assert!(!def.matching.fallback);
    }

    #[test]
    fn rejects_unknown_fields() {
        let err = ProfileDef::parse(
            "schema_version = 1\nid = \"x\"\n[layout]\nscan_root = [\"DCIM\"]\n",
            &origin(),
        )
        .unwrap_err();
        assert!(matches!(err, ProfileError::Parse { .. }), "{err}");
        assert!(err.to_string().contains("scan_root"), "{err}");
    }

    #[test]
    fn rejects_other_schema_versions_before_field_checks() {
        let err = ProfileDef::parse(
            "schema_version = 2\nid = \"x\"\nnew_field = true\n",
            &origin(),
        )
        .unwrap_err();
        assert!(matches!(
            err,
            ProfileError::UnsupportedSchema {
                found: 2,
                supported: 1,
                ..
            }
        ));
    }

    #[test]
    fn requires_schema_version() {
        let err = ProfileDef::parse("id = \"x\"\n", &origin()).unwrap_err();
        assert!(err.to_string().contains("schema_version"), "{err}");
    }

    #[test]
    fn rejects_malformed_toml() {
        let err = ProfileDef::parse("schema_version = \n", &origin()).unwrap_err();
        assert!(matches!(err, ProfileError::Parse { .. }));
    }

    #[test]
    fn overlay_inherits_omitted_fields_but_not_fallback() {
        let parent = ProfileDef::parse(
            "schema_version = 1\nid = \"p\"\n[match]\nfallback = true\n[kinds]\njpeg = [\"JPG\"]\nraw = [\"DNG\"]\n",
            &origin(),
        )
        .unwrap();
        let child = ProfileDef::parse(
            "schema_version = 1\nid = \"c\"\nextends = \"p\"\n[kinds]\nraw = [\"CR3\"]\n",
            &origin(),
        )
        .unwrap();
        let merged = child.overlay_on(&parent);
        assert_eq!(merged.id, "c");
        assert_eq!(merged.kinds.raw.as_deref(), Some(&["CR3".to_owned()][..]));
        assert_eq!(merged.kinds.jpeg.as_deref(), Some(&["JPG".to_owned()][..]));
        assert!(!merged.matching.fallback);
    }
}
