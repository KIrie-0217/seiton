//! Data transfer objects shared with the UI.
//!
//! These types are the contract between Rust and TypeScript. `cargo test`
//! regenerates `ui/src/bindings/*.ts` from them via ts-rs (see
//! `.cargo/config.toml`); CI fails if the committed bindings are stale.

use seiton_core::MediaKind;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// How a device is connected, as shown in the UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum TransportView {
    Mtp,
    MassStorage,
    Vendor,
}

/// A connected device (camera or card).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DeviceView {
    pub id: String,
    pub label: String,
    pub transport: TransportView,
    pub profile_id: String,
    pub profile_name: String,
    pub asset_count: u32,
}

/// One file of an asset (e.g. the CR3 of a RAW + JPEG pair).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct FileView {
    pub name: String,
    /// Device-relative path.
    pub path: String,
    pub kind: MediaKind,
    #[ts(type = "number | null")]
    pub size: Option<u64>,
}

/// Where the effective rating comes from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum RatingSource {
    /// Read from the file on the camera / card.
    Camera,
    /// Set in seiton.
    App,
}

/// A shot: one or more files sharing a name, plus its metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct AssetView {
    pub id: String,
    pub device_id: String,
    pub name: String,
    /// Local capture time `YYYY-MM-DDTHH:MM:SS` (EXIF has no time zone).
    pub capture_time: Option<String>,
    pub files: Vec<FileView>,
    /// Effective rating 0–5, `null` when unrated.
    pub rating: Option<u8>,
    pub rating_source: Option<RatingSource>,
    /// Already imported to a destination.
    pub imported: bool,
}

/// Sets (or clears, with `null`) the rating of several assets.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RatingUpdate {
    pub asset_ids: Vec<String>,
    pub rating: Option<u8>,
}

/// Result of scanning a local folder (Task 2 demo).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct FolderScan {
    pub source_label: String,
    pub profile_id: String,
    pub profile_name: String,
    pub groups: Vec<GroupView>,
}

/// Files grouped into one shot, without metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct GroupView {
    pub key: String,
    pub name: String,
    pub files: Vec<FileView>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn asset_view_uses_camel_case_json() {
        let asset = AssetView {
            id: "a1".into(),
            device_id: "d1".into(),
            name: "IMG_0001".into(),
            capture_time: Some("2026-09-20T10:15:30".into()),
            files: vec![FileView {
                name: "IMG_0001.CR3".into(),
                path: "DCIM/100CANON/IMG_0001.CR3".into(),
                kind: MediaKind::Raw,
                size: Some(1),
            }],
            rating: Some(3),
            rating_source: Some(RatingSource::Camera),
            imported: false,
        };
        let json = serde_json::to_value(&asset).unwrap();
        assert_eq!(json["deviceId"], "d1");
        assert_eq!(json["captureTime"], "2026-09-20T10:15:30");
        assert_eq!(json["ratingSource"], "camera");
        assert_eq!(json["files"][0]["kind"], "raw");
    }

    #[test]
    fn rating_update_accepts_null() {
        let update: RatingUpdate =
            serde_json::from_str(r#"{"assetIds":["a","b"],"rating":null}"#).unwrap();
        assert_eq!(update.asset_ids, ["a", "b"]);
        assert_eq!(update.rating, None);
    }

    #[test]
    fn transport_is_camel_case() {
        assert_eq!(
            serde_json::to_string(&TransportView::MassStorage).unwrap(),
            "\"massStorage\""
        );
    }
}
