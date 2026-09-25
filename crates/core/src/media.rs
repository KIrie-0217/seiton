//! Media file classification.

use serde::{Deserialize, Serialize};

/// The role of a file within an asset (a shot).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Raw,
    Heif,
    Jpeg,
    Video,
    /// Metadata sidecar such as `.xmp`.
    Sidecar,
}

impl MediaKind {
    pub const ALL: [Self; 5] = [
        Self::Raw,
        Self::Heif,
        Self::Jpeg,
        Self::Video,
        Self::Sidecar,
    ];

    /// Order of files inside an asset group: the declaration order.
    pub fn rank(self) -> u8 {
        self as u8
    }

    /// Stable lowercase name, as used in profiles and the UI.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Raw => "raw",
            Self::Heif => "heif",
            Self::Jpeg => "jpeg",
            Self::Video => "video",
            Self::Sidecar => "sidecar",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_as_lowercase() {
        for kind in MediaKind::ALL {
            let json = serde_json::to_string(&kind).unwrap();
            assert_eq!(json, format!("\"{}\"", kind.as_str()));
        }
    }

    #[test]
    fn rank_orders_primary_files_first() {
        let mut kinds = vec![MediaKind::Sidecar, MediaKind::Jpeg, MediaKind::Raw];
        kinds.sort_by_key(|k| k.rank());
        assert_eq!(kinds, [MediaKind::Raw, MediaKind::Jpeg, MediaKind::Sidecar]);
    }
}
