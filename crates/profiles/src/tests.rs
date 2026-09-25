use std::fs;

use seiton_core::MediaKind;
use seiton_device_api::fake::FakeSource;
use seiton_device_api::{DeviceId, DeviceInfo, Transport};

use super::*;

const CANON_CARD: &str = include_str!("../tests/fixtures/canon-card.txt");

fn builtin() -> BuiltProfiles {
    let built = ProfileRegistry::builtin().unwrap().build();
    assert!(built.warnings.is_empty(), "{:?}", built.warnings);
    built
}

fn by_id<'a>(built: &'a BuiltProfiles, id: &str) -> &'a dyn CameraProfile {
    built
        .profiles
        .iter()
        .find(|p| p.id() == id)
        .map(|p| p.as_ref())
        .unwrap_or_else(|| panic!("profile {id} missing"))
}

fn card_reader_info() -> DeviceInfo {
    DeviceInfo {
        id: DeviceId("fs:test".into()),
        transport: Transport::MassStorage,
        label: "EOS_DIGITAL".into(),
        usb_vendor_id: None,
        manufacturer: None,
        model: None,
        serial: None,
    }
}

fn summary(groups: &[MediaGroup]) -> Vec<(String, Vec<MediaKind>)> {
    groups
        .iter()
        .map(|g| (g.key.0.clone(), g.kinds().collect()))
        .collect()
}

// ---- builtin profiles ----

#[test]
fn builtin_profiles_are_valid_and_ordered() {
    let built = builtin();
    let ids: Vec<_> = built.profiles.iter().map(|p| p.id()).collect();
    assert_eq!(ids, ["canon", "generic-dcf"]);
    let canon = by_id(&built, "canon");
    assert_eq!(canon.name(), "Canon");
    assert_eq!(
        canon.rating_tags(),
        ["XMP:Rating", "Canon:Rating", "EXIF:Rating"]
    );
    assert_eq!(canon.scan_roots()[0].pattern(), "DCIM/*");
}

// ---- classification and pairing ----

#[test]
fn canon_card_is_grouped_into_shots() {
    let built = builtin();
    let src = FakeSource::from_listing(CANON_CARD).unwrap();
    let groups = scan(&src, by_id(&built, "canon")).unwrap();

    use MediaKind::*;
    assert_eq!(
        summary(&groups),
        [
            ("DCIM/100CANON/IMG_0001".to_owned(), vec![Raw, Jpeg]),
            ("DCIM/100CANON/IMG_0002".to_owned(), vec![Raw]),
            ("DCIM/100CANON/IMG_0003".to_owned(), vec![Jpeg]),
            (
                "DCIM/100CANON/IMG_0004".to_owned(),
                vec![Raw, Heif, Sidecar]
            ),
            ("DCIM/100CANON/MVI_0005".to_owned(), vec![Video]),
            // Same file number in another folder is a different shot;
            // extension and stem case are ignored for pairing.
            ("DCIM/101CANON/IMG_0001".to_owned(), vec![Raw, Jpeg]),
        ]
    );
    // CANONMSC, MISC, .THM and .DS_Store are not media.
    let all: Vec<_> = groups
        .iter()
        .flat_map(|g| g.files.iter().map(|f| f.entry.path.as_str()))
        .collect();
    assert!(
        all.iter()
            .all(|p| !p.contains("CANONMSC") && !p.starts_with("MISC"))
    );
    assert_eq!(groups[0].name, "IMG_0001");
    assert_eq!(groups[0].files[0].entry.size, Some(28_311_552));
}

#[test]
fn canon_profile_ignores_camera_settings_folder_even_with_media_extension() {
    let built = builtin();
    let src = FakeSource::from_listing("DCIM/CANONMSC/X.JPG\nDCIM/100CANON/IMG_0001.JPG").unwrap();
    let groups = scan(&src, by_id(&built, "canon")).unwrap();
    assert_eq!(
        summary(&groups),
        [("DCIM/100CANON/IMG_0001".to_owned(), vec![MediaKind::Jpeg])]
    );
}

#[test]
fn generic_profile_accepts_other_raw_formats() {
    let built = builtin();
    let src =
        FakeSource::from_listing("DCIM/100MSDCF/DSC00001.ARW\nDCIM/100MSDCF/DSC00001.JPG").unwrap();
    let generic = scan(&src, by_id(&built, "generic-dcf")).unwrap();
    assert_eq!(
        summary(&generic),
        [(
            "DCIM/100MSDCF/DSC00001".to_owned(),
            vec![MediaKind::Raw, MediaKind::Jpeg]
        )]
    );
    // Canon's narrower kind list does not treat ARW as RAW.
    let canon = scan(&src, by_id(&built, "canon")).unwrap();
    assert_eq!(
        summary(&canon),
        [("DCIM/100MSDCF/DSC00001".to_owned(), vec![MediaKind::Jpeg])]
    );
}

#[test]
fn missing_dcim_yields_no_groups() {
    let built = builtin();
    let src = FakeSource::from_listing("PRIVATE/M4ROOT/CLIP/C0001.MP4").unwrap();
    assert!(scan(&src, by_id(&built, "canon")).unwrap().is_empty());
}

#[test]
fn files_directly_in_dcim_are_not_media() {
    // `DCIM/*` means "folders inside DCIM".
    let built = builtin();
    let src = FakeSource::from_listing("DCIM/stray.JPG").unwrap();
    assert!(scan(&src, by_id(&built, "generic-dcf")).unwrap().is_empty());
}

// ---- resolution ----

#[test]
fn resolves_canon_from_folder_layout_on_card_reader() {
    let built = builtin();
    let src = FakeSource::from_listing(CANON_CARD).unwrap();
    let probe = Probe::collect(&src).unwrap();
    let p = resolve(&built.profiles, &card_reader_info(), &probe).unwrap();
    assert_eq!(p.id(), "canon");
}

#[test]
fn resolves_canon_from_usb_vendor_id_without_folders() {
    let built = builtin();
    let dev = DeviceInfo {
        transport: Transport::Mtp,
        usb_vendor_id: Some(0x04A9),
        ..card_reader_info()
    };
    let p = resolve(&built.profiles, &dev, &Probe::default()).unwrap();
    assert_eq!(p.id(), "canon");
}

#[test]
fn resolves_canon_from_exif_make_prefix() {
    let built = builtin();
    let probe = Probe {
        dirs: vec![],
        exif_make: Some("Canon Inc.".into()),
    };
    let canon = by_id(&built, "canon");
    assert_eq!(canon.score(&card_reader_info(), &probe), 80);
    let p = resolve(&built.profiles, &card_reader_info(), &probe).unwrap();
    assert_eq!(p.id(), "canon");
}

#[test]
fn unknown_camera_falls_back_to_generic() {
    let built = builtin();
    let src = FakeSource::from_listing("DCIM/100MSDCF/DSC00001.ARW").unwrap();
    let probe = Probe::collect(&src).unwrap();
    let dev = DeviceInfo {
        usb_vendor_id: Some(0x054C),
        manufacturer: Some("Sony".into()),
        ..card_reader_info()
    };
    assert_eq!(by_id(&built, "canon").score(&dev, &probe), 0);
    assert_eq!(
        resolve(&built.profiles, &dev, &probe).unwrap().id(),
        "generic-dcf"
    );
}

// ---- user profiles and validation ----

fn inline(reg: &mut ProfileRegistry, name: &str, text: &str) {
    reg.add_toml(text, ProfileOrigin::Inline(name.into()))
        .unwrap();
}

#[test]
fn user_profile_can_add_a_vendor() {
    let mut reg = ProfileRegistry::builtin().unwrap();
    inline(
        &mut reg,
        "sony",
        r#"
schema_version = 1
id = "sony"
name = "Sony"
extends = "generic-dcf"
[match]
usb_vendor_id = [0x054C]
[kinds]
raw = ["ARW"]
"#,
    );
    let built = reg.build();
    assert!(built.warnings.is_empty(), "{:?}", built.warnings);
    let ids: Vec<_> = built.profiles.iter().map(|p| p.id()).collect();
    assert_eq!(ids, ["canon", "sony", "generic-dcf"]);
    let sony = by_id(&built, "sony");
    // Inherited from generic-dcf.
    assert_eq!(sony.scan_roots()[0].pattern(), "DCIM/*");
    assert_eq!(sony.rating_tags(), ["XMP:Rating", "EXIF:Rating"]);
}

#[test]
fn user_profile_overrides_builtin_with_same_id() {
    let mut reg = ProfileRegistry::builtin().unwrap();
    inline(
        &mut reg,
        "canon-override",
        r#"
schema_version = 1
id = "canon"
name = "Canon (custom)"
extends = "generic-dcf"
[match]
exif_make = ["Canon"]
"#,
    );
    let built = reg.build();
    assert!(built.warnings.is_empty(), "{:?}", built.warnings);
    assert_eq!(by_id(&built, "canon").name(), "Canon (custom)");
}

#[test]
fn broken_override_falls_back_to_builtin_and_warns() {
    let mut reg = ProfileRegistry::builtin().unwrap();
    inline(
        &mut reg,
        "bad-canon",
        r#"
schema_version = 1
id = "canon"
extends = "generic-dcf"
[match]
exif_make = ["Canon"]
[kinds]
raw = ["JPG"]
"#,
    );
    let built = reg.build();
    assert_eq!(built.warnings.len(), 1);
    let msg = built.warnings[0].to_string();
    assert!(msg.contains("both raw and jpeg"), "{msg}");
    assert!(msg.contains("inline:bad-canon"), "{msg}");
    assert_eq!(by_id(&built, "canon").name(), "Canon");
}

#[test]
fn invalid_profiles_are_reported() {
    let cases = [
        (
            "no-match",
            "schema_version = 1\nid = \"x\"\n[layout]\nscan_roots=[\"DCIM/*\"]\n[kinds]\njpeg=[\"JPG\"]\n",
            "needs usb_vendor_id",
        ),
        (
            "bad-id",
            "schema_version = 1\nid = \"Bad_Id\"\n[match]\nfallback=true\n[layout]\nscan_roots=[\"DCIM/*\"]\n[kinds]\njpeg=[\"JPG\"]\n",
            "id must match",
        ),
        (
            "no-roots",
            "schema_version = 1\nid = \"x\"\n[match]\nfallback=true\n[kinds]\njpeg=[\"JPG\"]\n",
            "scan_roots must not be empty",
        ),
        (
            "bad-glob",
            "schema_version = 1\nid = \"x\"\n[match]\nfolder_signature=[\"DCIM/[\"]\n[layout]\nscan_roots=[\"DCIM/*\"]\n[kinds]\njpeg=[\"JPG\"]\n",
            "invalid glob",
        ),
        (
            "escape",
            "schema_version = 1\nid = \"x\"\n[match]\nfallback=true\n[layout]\nscan_roots=[\"../*\"]\n[kinds]\njpeg=[\"JPG\"]\n",
            "not allowed",
        ),
        (
            "bad-ext",
            "schema_version = 1\nid = \"x\"\n[match]\nfallback=true\n[layout]\nscan_roots=[\"DCIM/*\"]\n[kinds]\njpeg=[\"J/PG\"]\n",
            "invalid extension",
        ),
        (
            "no-kinds",
            "schema_version = 1\nid = \"x\"\n[match]\nfallback=true\n[layout]\nscan_roots=[\"DCIM/*\"]\n",
            "no file kinds",
        ),
    ];
    for (name, text, expected) in cases {
        let mut reg = ProfileRegistry::default();
        inline(&mut reg, name, text);
        let built = reg.build();
        assert!(built.profiles.is_empty(), "{name}: should be rejected");
        let msg = built
            .warnings
            .iter()
            .map(ToString::to_string)
            .collect::<Vec<_>>()
            .join("\n");
        assert!(msg.contains(expected), "{name}: {msg}");
    }
}

#[test]
fn unknown_parent_and_cycles_are_reported() {
    let mut reg = ProfileRegistry::default();
    inline(
        &mut reg,
        "orphan",
        "schema_version = 1\nid = \"orphan\"\nextends = \"nope\"\n",
    );
    inline(
        &mut reg,
        "a",
        "schema_version = 1\nid = \"a\"\nextends = \"b\"\n",
    );
    inline(
        &mut reg,
        "b",
        "schema_version = 1\nid = \"b\"\nextends = \"a\"\n",
    );
    let built = reg.build();
    assert!(built.profiles.is_empty());
    let msg = built
        .warnings
        .iter()
        .map(ToString::to_string)
        .collect::<Vec<_>>()
        .join("\n");
    assert!(msg.contains("extends unknown profile `nope`"), "{msg}");
    assert!(msg.contains("cycle"), "{msg}");
}

#[test]
fn load_user_dir_reads_toml_files_and_reports_errors() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(
        dir.path().join("sony.toml"),
        "schema_version = 1\nid = \"sony\"\nextends = \"generic-dcf\"\n[match]\nusb_vendor_id = [0x054C]\n",
    )
    .unwrap();
    fs::write(
        dir.path().join("future.TOML"),
        "schema_version = 9\nid = \"f\"\n",
    )
    .unwrap();
    fs::write(dir.path().join("notes.txt"), "not a profile").unwrap();

    let mut reg = ProfileRegistry::builtin().unwrap();
    let errors = reg.load_user_dir(dir.path());
    assert_eq!(errors.len(), 1);
    assert!(matches!(
        errors[0],
        ProfileError::UnsupportedSchema { found: 9, .. }
    ));
    assert!(errors[0].to_string().contains("future.TOML"));

    let built = reg.build();
    assert!(built.warnings.is_empty(), "{:?}", built.warnings);
    assert!(built.profiles.iter().any(|p| p.id() == "sony"));
}

#[test]
fn load_user_dir_ignores_missing_directory() {
    let mut reg = ProfileRegistry::builtin().unwrap();
    let dir = tempfile::tempdir().unwrap();
    assert!(reg.load_user_dir(&dir.path().join("missing")).is_empty());
}
