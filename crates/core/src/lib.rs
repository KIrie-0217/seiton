//! Domain model, rating sync, rule engine and path templates (no IO).
//!
//! See `docs/design.md` for the overall architecture.

/// Name of this crate, used by the app to report which components are built in.
pub const CRATE_NAME: &str = env!("CARGO_PKG_NAME");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crate_name_matches_package() {
        assert_eq!(CRATE_NAME, "seiton-core");
    }
}
