//! Mass-storage (SD card reader, card-mode camera) [`DeviceSource`].
//!
//! Files are read directly from a mounted directory. The source is
//! read-only and never follows symbolic links, so it cannot escape the root.

use std::fs::{self, File};
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use seiton_device_api::{
    Bytes, DeviceId, DeviceInfo, DeviceSource, Entry, EntryKind, ObjRef, Result, SourceCaps,
    SourceError, Transport, VPath,
};

/// A [`DeviceSource`] backed by a local directory (usually a volume root).
#[derive(Debug)]
pub struct FsSource {
    info: DeviceInfo,
    root: PathBuf,
}

impl FsSource {
    /// Opens `root`, which must be an existing directory.
    pub fn open(root: impl AsRef<Path>) -> Result<Self> {
        let root = fs::canonicalize(root.as_ref()).map_err(|e| map_io(e, root.as_ref()))?;
        if !root.is_dir() {
            return Err(SourceError::NotADirectory(root.display().to_string()));
        }
        let label = root
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| root.display().to_string());
        let info = DeviceInfo {
            id: DeviceId(format!("fs:{}", root.display())),
            transport: Transport::MassStorage,
            label,
            usb_vendor_id: None,
            manufacturer: None,
            model: None,
            serial: None,
        };
        Ok(Self { info, root })
    }

    /// The canonical root directory.
    pub fn root(&self) -> &Path {
        &self.root
    }

    fn resolve(&self, path: &VPath) -> PathBuf {
        let mut out = self.root.clone();
        for c in path.components() {
            out.push(c);
        }
        out
    }

    fn resolve_obj(&self, obj: &ObjRef) -> Result<PathBuf> {
        Ok(self.resolve(&VPath::parse(obj.as_str())?))
    }

    fn open_file(&self, obj: &ObjRef) -> Result<File> {
        let path = self.resolve_obj(obj)?;
        let meta = fs::symlink_metadata(&path).map_err(|e| map_io(e, &path))?;
        if !meta.is_file() {
            return Err(SourceError::NotFound(obj.as_str().to_owned()));
        }
        File::open(&path).map_err(|e| map_io(e, &path))
    }
}

fn map_io(e: io::Error, path: &Path) -> SourceError {
    match e.kind() {
        io::ErrorKind::NotFound => SourceError::NotFound(path.display().to_string()),
        _ => SourceError::Io(e),
    }
}

impl DeviceSource for FsSource {
    fn info(&self) -> &DeviceInfo {
        &self.info
    }

    fn caps(&self) -> SourceCaps {
        SourceCaps::RANGE_READ | SourceCaps::LOCAL_PATH
    }

    fn list(&self, dir: &VPath) -> Result<Vec<Entry>> {
        let path = self.resolve(dir);
        let meta = fs::symlink_metadata(&path).map_err(|e| map_io(e, &path))?;
        if !meta.is_dir() {
            return Err(SourceError::NotADirectory(dir.to_string()));
        }
        let mut out = Vec::new();
        for item in fs::read_dir(&path).map_err(|e| map_io(e, &path))? {
            let item = item?;
            let file_type = item.file_type()?;
            let kind = if file_type.is_dir() {
                EntryKind::Dir
            } else if file_type.is_file() {
                EntryKind::File
            } else {
                continue; // symlinks and special files are skipped
            };
            // Names that are not valid UTF-8 or not representable as a VPath
            // component are skipped; camera cards use DCF (ASCII) names.
            let Some(name) = item.file_name().to_str().map(str::to_owned) else {
                continue;
            };
            let Ok(child) = dir.join(&name) else {
                continue;
            };
            let meta = item.metadata()?;
            out.push(Entry {
                obj: ObjRef(child.as_str().to_owned()),
                path: child,
                kind,
                size: (kind == EntryKind::File).then_some(meta.len()),
                modified: meta.modified().ok(),
            });
        }
        out.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(out)
    }

    fn read_range(&self, obj: &ObjRef, offset: u64, len: u64) -> Result<Bytes> {
        let mut file = self.open_file(obj)?;
        let total = file.metadata()?.len();
        let start = offset.min(total);
        let want = len.min(total - start);
        file.seek(SeekFrom::Start(start))?;
        let mut buf = Vec::with_capacity(usize::try_from(want).unwrap_or(0));
        file.take(want).read_to_end(&mut buf)?;
        Ok(Bytes::from(buf))
    }

    fn open_stream(&self, obj: &ObjRef) -> Result<Box<dyn Read + Send>> {
        Ok(Box::new(self.open_file(obj)?))
    }

    fn local_path(&self, obj: &ObjRef) -> Option<PathBuf> {
        self.resolve_obj(obj).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use seiton_device_api::walk;

    fn card() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let d = dir.path().join("DCIM").join("100CANON");
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("IMG_0001.JPG"), b"0123456789").unwrap();
        fs::write(d.join("IMG_0001.CR3"), b"raw").unwrap();
        fs::create_dir_all(dir.path().join("MISC")).unwrap();
        dir
    }

    #[test]
    fn open_reports_mass_storage_caps() {
        let dir = card();
        let src = FsSource::open(dir.path()).unwrap();
        assert_eq!(src.info().transport, Transport::MassStorage);
        assert!(
            src.caps()
                .contains(SourceCaps::RANGE_READ | SourceCaps::LOCAL_PATH)
        );
        assert!(src.info().id.0.starts_with("fs:"));
    }

    #[test]
    fn open_rejects_missing_and_file_roots() {
        let dir = card();
        assert!(matches!(
            FsSource::open(dir.path().join("nope")),
            Err(SourceError::NotFound(_))
        ));
        let file = dir.path().join("DCIM/100CANON/IMG_0001.JPG");
        assert!(matches!(
            FsSource::open(file),
            Err(SourceError::NotADirectory(_))
        ));
    }

    #[test]
    fn lists_sorted_with_sizes() {
        let dir = card();
        let src = FsSource::open(dir.path()).unwrap();
        let all = walk(&src, &VPath::root(), 4).unwrap();
        let paths: Vec<_> = all.iter().map(|e| e.path.as_str()).collect();
        assert_eq!(
            paths,
            [
                "DCIM",
                "DCIM/100CANON",
                "DCIM/100CANON/IMG_0001.CR3",
                "DCIM/100CANON/IMG_0001.JPG",
                "MISC"
            ]
        );
        let jpg = &all[3];
        assert_eq!(jpg.size, Some(10));
        assert!(jpg.modified.is_some());
        assert_eq!(all[0].size, None);
    }

    #[test]
    fn reads_ranges_and_streams() {
        let dir = card();
        let src = FsSource::open(dir.path()).unwrap();
        let obj = ObjRef("DCIM/100CANON/IMG_0001.JPG".into());
        assert_eq!(&src.read_range(&obj, 3, 4).unwrap()[..], b"3456");
        assert_eq!(&src.read_range(&obj, 8, 100).unwrap()[..], b"89");
        assert!(src.read_range(&obj, 100, 1).unwrap().is_empty());

        let mut all = Vec::new();
        src.open_stream(&obj)
            .unwrap()
            .read_to_end(&mut all)
            .unwrap();
        assert_eq!(all, b"0123456789");

        let local = src.local_path(&obj).unwrap();
        assert!(local.ends_with(Path::new("DCIM").join("100CANON").join("IMG_0001.JPG")));
    }

    #[test]
    fn rejects_escaping_and_directory_objects() {
        let dir = card();
        let src = FsSource::open(dir.path()).unwrap();
        assert!(matches!(
            src.read_range(&ObjRef("../secret".into()), 0, 1),
            Err(SourceError::Path(_))
        ));
        assert!(matches!(
            src.read_range(&ObjRef("DCIM".into()), 0, 1),
            Err(SourceError::NotFound(_))
        ));
        assert!(matches!(
            src.list(&VPath::parse("DCIM/100CANON/IMG_0001.JPG").unwrap()),
            Err(SourceError::NotADirectory(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn skips_symlinks() {
        let dir = card();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), dir.path().join("DCIM/link")).unwrap();
        let src = FsSource::open(dir.path()).unwrap();
        let names: Vec<_> = src
            .list(&VPath::parse("DCIM").unwrap())
            .unwrap()
            .into_iter()
            .map(|e| e.path.as_str().to_owned())
            .collect();
        assert_eq!(names, ["DCIM/100CANON"]);
        assert!(src.list(&VPath::parse("DCIM/link").unwrap()).is_err());
    }
}
