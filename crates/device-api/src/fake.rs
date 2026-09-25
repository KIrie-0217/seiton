//! In-memory [`DeviceSource`] for tests (enable the `fake` feature).

use std::collections::{BTreeMap, BTreeSet};
use std::io::{Cursor, Read};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, SystemTime};

use bytes::Bytes;

use crate::path::VPath;
use crate::source::{
    DeviceId, DeviceInfo, DeviceSource, Entry, EntryKind, ObjRef, Result, SourceCaps, SourceError,
    Transport,
};

#[derive(Debug, Clone)]
enum FakeData {
    Bytes(Bytes),
    /// Content is `size` zero bytes, generated on read (keeps dumps cheap).
    Zeros(u64),
}

impl FakeData {
    fn len(&self) -> u64 {
        match self {
            Self::Bytes(b) => b.len() as u64,
            Self::Zeros(n) => *n,
        }
    }
}

/// A device whose files live in memory.
///
/// Object references are the file paths. `read_count` counts calls to
/// `read_range` / `open_stream` so tests can assert that caches avoid IO.
#[derive(Debug)]
pub struct FakeSource {
    info: DeviceInfo,
    caps: SourceCaps,
    files: BTreeMap<VPath, FakeData>,
    dirs: BTreeSet<VPath>,
    reads: AtomicUsize,
}

impl FakeSource {
    pub fn new(info: DeviceInfo) -> Self {
        Self {
            info,
            caps: SourceCaps::RANGE_READ,
            files: BTreeMap::new(),
            dirs: BTreeSet::new(),
            reads: AtomicUsize::new(0),
        }
    }

    /// A mass-storage device with a fixed test identity.
    pub fn mass_storage(label: &str) -> Self {
        Self::new(DeviceInfo {
            id: DeviceId(format!("fake:{label}")),
            transport: Transport::MassStorage,
            label: label.to_owned(),
            usb_vendor_id: None,
            manufacturer: None,
            model: None,
            serial: None,
        })
    }

    /// Builds a source from a directory dump.
    ///
    /// Each non-empty line is `PATH` or `SIZE PATH`; `#` starts a comment.
    /// A trailing `/` declares an empty directory.
    pub fn from_listing(listing: &str) -> Result<Self> {
        let mut src = Self::mass_storage("fake");
        for line in listing.lines() {
            let line = line.split('#').next().unwrap_or("").trim();
            if line.is_empty() {
                continue;
            }
            let (size, path) = match line.split_once(char::is_whitespace) {
                Some((n, rest)) if n.parse::<u64>().is_ok() => {
                    (n.parse::<u64>().unwrap_or(0), rest.trim())
                }
                _ => (0, line),
            };
            if path.ends_with('/') {
                src.add_dir(path)?;
            } else {
                src.add_zeros(path, size)?;
            }
        }
        Ok(src)
    }

    pub fn with_caps(mut self, caps: SourceCaps) -> Self {
        self.caps = caps;
        self
    }

    pub fn with_info(mut self, info: DeviceInfo) -> Self {
        self.info = info;
        self
    }

    pub fn add_file(&mut self, path: &str, data: impl Into<Bytes>) -> Result<&mut Self> {
        self.insert(path, FakeData::Bytes(data.into()))
    }

    pub fn add_zeros(&mut self, path: &str, size: u64) -> Result<&mut Self> {
        self.insert(path, FakeData::Zeros(size))
    }

    pub fn add_dir(&mut self, path: &str) -> Result<&mut Self> {
        let p = VPath::parse(path)?;
        self.add_ancestors(&p);
        if !p.is_root() {
            self.dirs.insert(p);
        }
        Ok(self)
    }

    /// Number of content reads performed so far.
    pub fn read_count(&self) -> usize {
        self.reads.load(Ordering::SeqCst)
    }

    fn insert(&mut self, path: &str, data: FakeData) -> Result<&mut Self> {
        let p = VPath::parse(path)?;
        if p.is_root() {
            return Err(SourceError::NotFound(path.to_owned()));
        }
        self.add_ancestors(&p);
        self.files.insert(p, data);
        Ok(self)
    }

    fn add_ancestors(&mut self, p: &VPath) {
        for a in p.ancestors() {
            self.dirs.insert(a);
        }
    }

    fn file(&self, obj: &ObjRef) -> Result<&FakeData> {
        let p = VPath::parse(obj.as_str())?;
        self.files
            .get(&p)
            .ok_or_else(|| SourceError::NotFound(obj.as_str().to_owned()))
    }

    fn entry(path: &VPath, kind: EntryKind, size: Option<u64>) -> Entry {
        Entry {
            obj: ObjRef(path.as_str().to_owned()),
            path: path.clone(),
            kind,
            size,
            modified: Some(SystemTime::UNIX_EPOCH + Duration::from_secs(1_700_000_000)),
        }
    }
}

impl DeviceSource for FakeSource {
    fn info(&self) -> &DeviceInfo {
        &self.info
    }

    fn caps(&self) -> SourceCaps {
        self.caps
    }

    fn list(&self, dir: &VPath) -> Result<Vec<Entry>> {
        if !dir.is_root() && !self.dirs.contains(dir) {
            return if self.files.contains_key(dir) {
                Err(SourceError::NotADirectory(dir.to_string()))
            } else {
                Err(SourceError::NotFound(dir.to_string()))
            };
        }
        let is_child = |p: &VPath| p.parent().as_ref() == Some(dir);
        let mut out: Vec<Entry> = self
            .dirs
            .iter()
            .filter(|d| is_child(d))
            .map(|d| Self::entry(d, EntryKind::Dir, None))
            .chain(
                self.files
                    .iter()
                    .filter(|(p, _)| is_child(p))
                    .map(|(p, d)| Self::entry(p, EntryKind::File, Some(d.len()))),
            )
            .collect();
        out.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(out)
    }

    fn read_range(&self, obj: &ObjRef, offset: u64, len: u64) -> Result<Bytes> {
        self.reads.fetch_add(1, Ordering::SeqCst);
        let data = self.file(obj)?;
        let total = data.len();
        let start = offset.min(total);
        let end = offset.saturating_add(len).min(total);
        Ok(match data {
            FakeData::Bytes(b) => b.slice(start as usize..end as usize),
            FakeData::Zeros(_) => Bytes::from(vec![0u8; (end - start) as usize]),
        })
    }

    fn open_stream(&self, obj: &ObjRef) -> Result<Box<dyn Read + Send>> {
        self.reads.fetch_add(1, Ordering::SeqCst);
        let bytes = match self.file(obj)? {
            FakeData::Bytes(b) => b.clone(),
            FakeData::Zeros(n) => Bytes::from(vec![0u8; *n as usize]),
        };
        Ok(Box::new(Cursor::new(bytes)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn listing_parses_sizes_comments_and_dirs() {
        let src = FakeSource::from_listing(
            "# card dump\n1024 DCIM/100CANON/IMG_0001.CR3\nDCIM/100CANON/IMG_0001.JPG  # no size\nDCIM/EMPTY/\n",
        )
        .unwrap();
        let dcim = src.list(&VPath::parse("DCIM").unwrap()).unwrap();
        let names: Vec<_> = dcim.iter().map(|e| e.path.as_str()).collect();
        assert_eq!(names, ["DCIM/100CANON", "DCIM/EMPTY"]);

        let files = src.list(&VPath::parse("DCIM/100CANON").unwrap()).unwrap();
        assert_eq!(files[0].size, Some(1024));
        assert_eq!(files[1].size, Some(0));
        assert!(files.iter().all(Entry::is_file));
    }

    #[test]
    fn read_range_clamps_and_counts() {
        let mut src = FakeSource::mass_storage("t");
        src.add_file("a.bin", b"0123456789".to_vec()).unwrap();
        let obj = ObjRef("a.bin".into());
        assert_eq!(&src.read_range(&obj, 2, 3).unwrap()[..], b"234");
        assert_eq!(&src.read_range(&obj, 8, 100).unwrap()[..], b"89");
        assert!(src.read_range(&obj, 50, 1).unwrap().is_empty());
        assert_eq!(src.read_count(), 3);

        let mut all = Vec::new();
        src.open_stream(&obj)
            .unwrap()
            .read_to_end(&mut all)
            .unwrap();
        assert_eq!(all, b"0123456789");
        assert_eq!(src.read_count(), 4);
    }

    #[test]
    fn list_errors() {
        let src = FakeSource::from_listing("a/b.JPG").unwrap();
        assert!(matches!(
            src.list(&VPath::parse("x").unwrap()),
            Err(SourceError::NotFound(_))
        ));
        assert!(matches!(
            src.list(&VPath::parse("a/b.JPG").unwrap()),
            Err(SourceError::NotADirectory(_))
        ));
    }
}
