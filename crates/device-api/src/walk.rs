//! Recursive listing on top of [`DeviceSource::list`].

use crate::path::VPath;
use crate::source::{DeviceSource, Entry, Result};

/// Lists everything below `root`, depth-first in path order.
///
/// Children of `root` are depth 1; directories deeper than `max_depth` are
/// returned but not descended into. `root` itself is not included.
pub fn walk(src: &dyn DeviceSource, root: &VPath, max_depth: usize) -> Result<Vec<Entry>> {
    let mut out = Vec::new();
    walk_into(src, root, 1, max_depth, &mut out)?;
    Ok(out)
}

fn walk_into(
    src: &dyn DeviceSource,
    dir: &VPath,
    depth: usize,
    max_depth: usize,
    out: &mut Vec<Entry>,
) -> Result<()> {
    if depth > max_depth {
        return Ok(());
    }
    for entry in src.list(dir)? {
        let descend = entry.is_dir().then(|| entry.path.clone());
        out.push(entry);
        if let Some(child) = descend {
            walk_into(src, &child, depth + 1, max_depth, out)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fake::FakeSource;
    use crate::source::SourceError;

    fn paths(entries: &[Entry]) -> Vec<&str> {
        entries.iter().map(|e| e.path.as_str()).collect()
    }

    #[test]
    fn walks_depth_first_in_order() {
        let src = FakeSource::from_listing(
            "DCIM/100CANON/IMG_0002.JPG\nDCIM/100CANON/IMG_0001.JPG\nDCIM/101CANON/IMG_0003.JPG\nMISC/x",
        )
        .unwrap();
        let all = walk(&src, &VPath::root(), 8).unwrap();
        assert_eq!(
            paths(&all),
            [
                "DCIM",
                "DCIM/100CANON",
                "DCIM/100CANON/IMG_0001.JPG",
                "DCIM/100CANON/IMG_0002.JPG",
                "DCIM/101CANON",
                "DCIM/101CANON/IMG_0003.JPG",
                "MISC",
                "MISC/x",
            ]
        );
    }

    #[test]
    fn respects_max_depth() {
        let src = FakeSource::from_listing("DCIM/100CANON/IMG_0001.JPG").unwrap();
        let shallow = walk(&src, &VPath::root(), 2).unwrap();
        assert_eq!(paths(&shallow), ["DCIM", "DCIM/100CANON"]);
    }

    #[test]
    fn missing_root_is_not_found() {
        let src = FakeSource::from_listing("DCIM/a.JPG").unwrap();
        let err = walk(&src, &VPath::parse("NOPE").unwrap(), 3).unwrap_err();
        assert!(matches!(err, SourceError::NotFound(_)));
    }
}
