//! ExifTool-based metadata provider (stay_open process).
//!
//! See `docs/architecture.md` for the overall architecture.

/// Name of this crate, used by the app to report which components are built in.
pub const CRATE_NAME: &str = env!("CARGO_PKG_NAME");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crate_name_matches_package() {
        assert_eq!(CRATE_NAME, "seiton-metadata-exiftool");
    }
}
