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

// ---- import settings (Task 3.1 UI; executed from Task 9) ----

/// Which image files of a shot to save. HEIF counts as "JPG" (a developed image).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum SaveFormats {
    RawOnly,
    RawAndJpeg,
    JpegOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum FormatMode {
    /// One setting for every rating.
    Uniform,
    /// A setting per rating (unrated, ★1–★5).
    PerRating,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct FormatSettings {
    pub mode: FormatMode,
    pub uniform: SaveFormats,
    /// Six entries indexed by stars: 0 = unrated, 1–5 = ★1–★5.
    pub per_rating: Vec<SaveFormats>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum FolderMode {
    Simple,
    Advanced,
}

/// Checkbox-based folder layout; converted to a template.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SimpleFolders {
    pub by_date: bool,
    pub by_hour: bool,
    pub by_rating: bool,
    pub split_raw_jpeg: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct FolderSettings {
    pub mode: FolderMode,
    pub simple: SimpleFolders,
    /// Folder template for the advanced mode, e.g. `{yyyy}-{MM}-{dd}/{file}`.
    pub template: String,
}

/// Default import settings (edited in the Import Settings pane).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ImportSettings {
    pub formats: FormatSettings,
    /// Destination root folder; `null` until chosen.
    pub destination_root: Option<String>,
    pub folders: FolderSettings,
}

/// Media categories offered in the import dialog.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum MediaCategory {
    /// RAW, JPEG, HEIF.
    Image,
    Video,
    /// Sidecars such as XMP or Sony's clip XML.
    Metadata,
}

/// What to import from a device (the import dialog's choices).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ImportRequest {
    pub device_id: String,
    /// Stars to include: 0 = unrated, 1–5.
    pub ratings: Vec<u8>,
    pub media: Vec<MediaCategory>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum ImportState {
    Running,
    Completed,
    Cancelled,
    Failed,
}

/// Progress of an import job, broadcast to every window while it runs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ImportProgress {
    pub job_id: String,
    pub device_id: String,
    pub state: ImportState,
    pub files_done: u32,
    pub files_total: u32,
    #[ts(type = "number")]
    pub bytes_done: u64,
    #[ts(type = "number")]
    pub bytes_total: u64,
    pub current_file: Option<String>,
    pub error: Option<String>,
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

    #[test]
    fn import_settings_round_trip_in_camel_case() {
        let settings = ImportSettings {
            formats: FormatSettings {
                mode: FormatMode::PerRating,
                uniform: SaveFormats::RawAndJpeg,
                per_rating: vec![SaveFormats::JpegOnly; 6],
            },
            destination_root: None,
            folders: FolderSettings {
                mode: FolderMode::Simple,
                simple: SimpleFolders {
                    by_date: true,
                    by_hour: false,
                    by_rating: false,
                    split_raw_jpeg: true,
                },
                template: "{yyyy}-{MM}-{dd}/{file}".into(),
            },
        };
        let json = serde_json::to_value(&settings).unwrap();
        assert_eq!(json["formats"]["mode"], "perRating");
        assert_eq!(json["formats"]["perRating"][0], "jpegOnly");
        assert_eq!(json["destinationRoot"], serde_json::Value::Null);
        assert_eq!(json["folders"]["simple"]["splitRawJpeg"], true);
        let back: ImportSettings = serde_json::from_value(json).unwrap();
        assert_eq!(back, settings);
    }

    #[test]
    fn import_request_and_progress_json() {
        let req: ImportRequest = serde_json::from_str(
            r#"{"deviceId":"d","ratings":[0,3],"media":["image","metadata"]}"#,
        )
        .unwrap();
        assert_eq!(req.media, [MediaCategory::Image, MediaCategory::Metadata]);
        let p = ImportProgress {
            job_id: "j".into(),
            device_id: "d".into(),
            state: ImportState::Running,
            files_done: 1,
            files_total: 2,
            bytes_done: 10,
            bytes_total: 20,
            current_file: Some("IMG_0001.CR3".into()),
            error: None,
        };
        let json = serde_json::to_value(&p).unwrap();
        assert_eq!(json["state"], "running");
        assert_eq!(json["filesTotal"], 2);
    }
}
