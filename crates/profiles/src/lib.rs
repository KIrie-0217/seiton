//! Camera profiles: how to recognize a camera and interpret its files.
//!
//! Profiles are TOML files (`profiles/*.toml` bundled, plus the user's
//! profile folder). They describe device matching, the folder layout, which
//! extensions are RAW / JPEG / video, and where ratings are stored.
//! See `docs/architecture.md` §6.

mod def;
mod profile;
mod registry;
mod scan;

pub use def::{
    KindsDef, LayoutDef, MatchDef, MetadataDef, ProfileDef, ProfileError, ProfileOrigin,
    SCHEMA_VERSION,
};
pub use profile::{CameraProfile, GroupKey, Probe, ScanRoot, TomlProfile};
pub use registry::{BuiltProfiles, ProfileRegistry, resolve};
pub use scan::{MediaFile, MediaGroup, scan};

#[cfg(test)]
mod tests;
